import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Create a new expense in a group
 */
export const create = mutation({
  args: {
    groupId: v.id("groups"),
    description: v.string(),
    amount: v.number(),
    splitType: v.union(v.literal("equal"), v.literal("custom")),
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

    // Validate splits
    if (args.splitType === "equal") {
      // For equal splits, we'll calculate the amounts automatically
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();

      const splitAmount = args.amount / members.length;
      args.splits = members.map((member) => ({
        userId: member.userId,
        amount: splitAmount,
      }));
    } else {
      // For custom splits, validate that the sum equals the total amount
      const totalSplit = args.splits.reduce(
        (sum, split) => sum + split.amount,
        0,
      );
      if (Math.abs(totalSplit - args.amount) > 0.01) {
        throw new Error("Split amounts must sum to the total amount");
      }
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
    for (const split of args.splits) {
      await ctx.db.insert("expenseSplits", {
        expenseId,
        userId: split.userId,
        amount: split.amount,
        settled: false,
      });
    }

    // Update balances
    await ctx.db.patch(args.groupId, {
      totalBalance:
        (await ctx.db.get(args.groupId))!.totalBalance + args.amount,
    });

    for (const split of args.splits) {
      const memberBalance = (await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_user", (q) =>
          q.eq("groupId", args.groupId).eq("userId", split.userId),
        )
        .unique())!.balance;

      await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_user", (q) =>
          q.eq("groupId", args.groupId).eq("userId", split.userId),
        )
        .unique()
        .then((member) => {
          if (member) {
            ctx.db.patch(member._id, {
              balance: memberBalance - split.amount,
            });
          }
        });
    }

    // Update payer's balance
    const payerBalance = (await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      )
      .unique())!.balance;

    await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      )
      .unique()
      .then((member) => {
        if (member) {
          ctx.db.patch(member._id, {
            balance: payerBalance + args.amount,
          });
        }
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
      splitType: v.union(v.literal("equal"), v.literal("custom")),
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
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
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
