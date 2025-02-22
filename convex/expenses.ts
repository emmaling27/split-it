import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Validator } from "convex/values";
import { Id } from "./_generated/dataModel";

type SuccessResponse<T> = {
  result: "success";
  value: T;
};

type ErrorResponse = {
  result: "error";
  message: string;
};

type MutationResult<T> = SuccessResponse<T> | ErrorResponse;

function MutationResponse<T>(valueValidator: Validator<T>) {
  return v.union(
    v.object({
      result: v.literal("success"),
      value: valueValidator,
    }),
    v.object({
      result: v.literal("error"),
      message: v.string(),
    }),
  );
}

/**
 * Create a new expense in a group
 */
export const create = mutation({
  args: {
    groupId: v.id("groups"),
    description: v.string(),
    amount: v.number(),
    splitType: v.union(v.literal("default"), v.literal("custom")),
    splits: v.array(
      v.object({
        userId: v.id("users"),
        amount: v.number(),
      }),
    ),
    note: v.optional(v.string()),
  },
  returns: MutationResponse(v.id("expenses")),
  handler: async (ctx, args): Promise<MutationResult<Id<"expenses">>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        result: "error",
        message: "Please sign in to create an expense.",
      };
    }

    // Check if user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      return {
        result: "error",
        message: "You don't have permission to create expenses in this group.",
      };
    }

    // Get the group to check split configuration
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return {
        result: "error",
        message: "Group not found.",
      };
    }

    // Get all group members
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Calculate splits based on given configuration
    let splits = args.splits;
    if (args.splitType === "default") {
      // Use each member's splitPercent for default splits
      splits = members.map((member) => ({
        userId: member.userId,
        amount: (args.amount * member.splitPercent) / 100,
      }));
    }
    // else use the provided custom splits

    // Validate that splits sum to total amount
    const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(totalSplit - args.amount) > 0.01) {
      return {
        result: "error",
        message: "Split amounts must add up to the total expense amount.",
      };
    }

    // Create the expense
    const expenseId = await ctx.db.insert("expenses", {
      description: args.description,
      amount: args.amount,
      date: Date.now(),
      groupId: args.groupId,
      paidBy: userId,
      splitType: args.splitType,
      note: args.note,
      status: "active",
    });

    // Create the splits
    for (const split of splits) {
      await ctx.db.insert("expenseSplits", {
        expenseId,
        userId: split.userId,
        amount: split.amount,
        settled: false,
      });

      // Update member balance
      const member = members.find((m) => m.userId === split.userId);
      if (member) {
        // If this is the payer, add the full amount and subtract their split
        if (member.userId === userId) {
          await ctx.db.patch(member._id, {
            balance: member.balance + args.amount - split.amount,
          });
        } else {
          // For others, just subtract their split
          await ctx.db.patch(member._id, {
            balance: member.balance - split.amount,
          });
        }
      }
    }

    // Update group total balance
    await ctx.db.patch(args.groupId, {
      totalBalance: group.totalBalance + args.amount,
    });

    return {
      result: "success",
      value: expenseId,
    };
  },
});

/**
 * List all expenses in a group
 */
export const listByGroup = query({
  args: {
    groupId: v.id("groups"),
    showSettled: v.optional(v.boolean()),
  },
  returns: v.object({
    expenses: v.array(
      v.object({
        _id: v.id("expenses"),
        _creationTime: v.number(),
        groupId: v.id("groups"),
        description: v.string(),
        amount: v.number(),
        date: v.number(),
        paidBy: v.id("users"),
        splitType: v.union(v.literal("default"), v.literal("custom")),
        note: v.optional(v.string()),
        status: v.union(v.literal("active"), v.literal("settled")),
        splits: v.array(
          v.object({
            userId: v.id("users"),
            amount: v.number(),
            settled: v.boolean(),
          }),
        ),
      }),
    ),
    hasSettled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      throw new Error("Not a member of this group");
    }

    // Check if there are any settled expenses
    const hasSettled = await ctx.db
      .query("expenses")
      .withIndex("by_group_and_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "settled"),
      )
      .first()
      .then(Boolean);

    // Get expenses based on showSettled parameter
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group_and_status", (q) =>
        args.showSettled
          ? q.eq("groupId", args.groupId)
          : q.eq("groupId", args.groupId).eq("status", "active"),
      )
      .order("desc")
      .collect();

    const expensesWithSplits = await Promise.all(
      expenses.map(async (expense) => {
        const splits = await ctx.db
          .query("expenseSplits")
          .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
          .collect();

        return {
          ...expense,
          splits: splits.map((split) => ({
            userId: split.userId,
            amount: split.amount,
            settled: split.settled,
          })),
        };
      }),
    );

    return {
      expenses: expensesWithSplits,
      hasSettled,
    };
  },
});

/**
 * Mark an expense split as settled
 */
export const settleExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    userId: v.id("users"),
  },
  returns: MutationResponse(v.null()),
  handler: async (ctx, args): Promise<MutationResult<null>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        result: "error",
        message: "Please sign in to settle expenses.",
      };
    }

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      return {
        result: "error",
        message: "Expense not found.",
      };
    }

    // Only the person who paid can mark splits as settled
    if (expense.paidBy !== userId) {
      return {
        result: "error",
        message: "Only the payer can settle expense splits.",
      };
    }

    const split = await ctx.db
      .query("expenseSplits")
      .withIndex("by_expense_and_user", (q) =>
        q.eq("expenseId", args.expenseId).eq("userId", args.userId),
      )
      .unique();

    if (!split) {
      return {
        result: "error",
        message: "Split not found.",
      };
    }

    if (split.settled) {
      return {
        result: "error",
        message: "Split is already settled.",
      };
    }

    await ctx.db.patch(split._id, {
      settled: true,
    });

    // Check if all splits are settled
    const unsettledSplits = await ctx.db
      .query("expenseSplits")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .filter((q) => q.eq(q.field("settled"), false))
      .collect();

    if (unsettledSplits.length === 0) {
      await ctx.db.patch(args.expenseId, {
        status: "settled",
      });
    }

    return {
      result: "success",
      value: null,
    };
  },
});

/**
 * Settle up all expenses in a group and reset balances
 */
export const settleGroup = mutation({
  args: {
    groupId: v.id("groups"),
  },
  returns: MutationResponse(v.null()),
  handler: async (ctx, args): Promise<MutationResult<null>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        result: "error",
        message: "Please sign in to settle the group.",
      };
    }

    // Check if user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      return {
        result: "error",
        message: "You don't have permission to settle this group.",
      };
    }

    // Get all active expenses in the group
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group_and_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "active"),
      )
      .collect();

    // For each expense, mark all splits as settled
    for (const expense of expenses) {
      const splits = await ctx.db
        .query("expenseSplits")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      for (const split of splits) {
        await ctx.db.patch(split._id, {
          settled: true,
        });
      }

      // Mark the expense as settled
      await ctx.db.patch(expense._id, {
        status: "settled",
      });
    }

    // Reset all member balances to zero
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const member of members) {
      await ctx.db.patch(member._id, {
        balance: 0,
      });
    }

    // Reset group total balance
    await ctx.db.patch(args.groupId, {
      totalBalance: 0,
    });

    return {
      result: "success",
      value: null,
    };
  },
});

/**
 * Delete an expense and update balances
 */
export const deleteExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  returns: MutationResponse(v.null()),
  handler: async (ctx, args): Promise<MutationResult<null>> => {
    console.log("Starting deleteExpense mutation for:", args.expenseId);

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      console.log("Delete failed: User not authenticated");
      return {
        result: "error",
        message: "Please sign in to delete expenses.",
      };
    }

    // Get the expense
    const expense = await ctx.db.get(args.expenseId);
    console.log("Found expense:", expense);

    if (!expense) {
      console.log("Delete failed: Expense not found");
      return {
        result: "error",
        message: "Expense not found.",
      };
    }

    // Only the person who paid can delete the expense
    if (expense.paidBy !== userId) {
      console.log(
        "Delete failed: User",
        userId,
        "is not the payer",
        expense.paidBy,
      );
      return {
        result: "error",
        message: "Only the payer can delete this expense.",
      };
    }

    // Get all splits for this expense
    const splits = await ctx.db
      .query("expenseSplits")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .collect();
    console.log("Found splits:", splits);

    // Get all members of the group
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", expense.groupId))
      .collect();
    console.log("Found group members:", members);

    console.log("Updating member balances...");
    // Update member balances
    for (const split of splits) {
      const member = members.find((m) => m.userId === split.userId);
      if (member) {
        // If this is the payer, subtract the full amount and add their split
        if (member.userId === expense.paidBy) {
          console.log("Updating payer balance for:", member.userId);
          await ctx.db.patch(member._id, {
            balance: member.balance - expense.amount + split.amount,
          });
        } else {
          // For others, just add their split back
          console.log("Updating member balance for:", member.userId);
          await ctx.db.patch(member._id, {
            balance: member.balance + split.amount,
          });
        }
      }
    }

    // Update group total balance
    const group = await ctx.db.get(expense.groupId);
    if (group) {
      console.log(
        "Updating group balance from",
        group.totalBalance,
        "to",
        group.totalBalance - expense.amount,
      );
      await ctx.db.patch(expense.groupId, {
        totalBalance: group.totalBalance - expense.amount,
      });
    }

    console.log("Deleting splits...");
    // Delete all splits
    for (const split of splits) {
      await ctx.db.delete(split._id);
    }

    console.log("Deleting expense...");
    // Delete the expense
    await ctx.db.delete(args.expenseId);

    console.log("Delete operation completed successfully");
    return {
      result: "success",
      value: null,
    };
  },
});
