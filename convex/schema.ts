import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
export default defineSchema({
  ...authTables,

  // Groups table for creating groups to split expenses
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // The user who created the group
    createdBy: v.id("users"),
    // Total balance of the group
    totalBalance: v.number(),
  }),

  // GroupMembers table to track members in each group
  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    // Balance for this user in this group
    balance: v.number(),
    // Role can be "admin" or "member"
    role: v.union(v.literal("admin"), v.literal("member")),
    // Default split percentage for this member (0-100)
    splitPercent: v.optional(v.number()),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_and_user", ["groupId", "userId"]),

  // Invitations table to track group invites
  invitations: defineTable({
    groupId: v.id("groups"),
    email: v.string(),
    invitedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
    ),
    expiresAt: v.number(), // Unix timestamp
  })
    .index("by_email", ["email"])
    .index("by_group", ["groupId"])
    .index("by_group_and_email", ["groupId", "email"]),

  // Expenses table to store all expenses
  expenses: defineTable({
    // Basic expense info
    description: v.string(),
    amount: v.number(),
    date: v.number(), // Unix timestamp
    groupId: v.id("groups"),
    // Who paid for the expense
    paidBy: v.id("users"),
    // Type of split: "equal" or "custom"
    splitType: v.union(v.literal("equal"), v.literal("custom")),
    // Optional note
    note: v.optional(v.string()),
    // Status of the expense: "active" or "settled"
    status: v.union(v.literal("active"), v.literal("settled")),
  })
    .index("by_group", ["groupId"])
    .index("by_paid_by", ["paidBy"]),

  // ExpenseSplits table to store how each expense is split
  expenseSplits: defineTable({
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    // Amount this user owes/is owed
    amount: v.number(),
    // Whether this split has been settled
    settled: v.boolean(),
  })
    .index("by_expense", ["expenseId"])
    .index("by_user", ["userId"])
    .index("by_expense_and_user", ["expenseId", "userId"]),
});
