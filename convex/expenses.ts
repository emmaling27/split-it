import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
  returns: v.id("expenses"),
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

    // Get the group to check split configuration
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

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
      throw new Error("Split amounts must sum to the total amount");
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

    return expenseId;
  },
});

/**
 * List all expenses in a group
 */
export const listByGroup = query({
  args: {
    groupId: v.id("groups"),
  },
  returns: v.array(
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

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group_and_status", (q) => q.eq("groupId", args.groupId))
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

    return expensesWithSplits;
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    // Only the person who paid can mark splits as settled
    if (expense.paidBy !== userId) {
      throw new Error("Only the payer can settle expense splits");
    }

    const split = await ctx.db
      .query("expenseSplits")
      .withIndex("by_expense_and_user", (q) =>
        q.eq("expenseId", args.expenseId).eq("userId", args.userId),
      )
      .unique();

    if (!split) {
      throw new Error("Split not found");
    }

    if (split.settled) {
      throw new Error("Split is already settled");
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

    return null;
  },
});

/**
 * Settle up all expenses in a group and reset balances
 */
export const settleGroup = mutation({
  args: {
    groupId: v.id("groups"),
  },
  returns: v.null(),
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

    return null;
  },
});
