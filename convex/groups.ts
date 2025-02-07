import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Create a new group
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("groups"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      description: args.description,
      createdBy: userId,
      totalBalance: 0,
      customSplitRatio: false,
    });

    // Add creator as an admin member
    await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      balance: 0,
      role: "admin",
      splitPercent: 100,
    });

    return groupId;
  },
});

/**
 * Add a member to a group
 */
export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if the current user is an admin of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      )
      .unique();

    if (!membership || membership.role !== "admin") {
      throw new Error("Only group admins can add members");
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .unique();

    if (existingMembership) {
      throw new Error("User is already a member of this group");
    }

    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      balance: 0,
      role: args.role,
    });

    return null;
  },
});

/**
 * List all groups that the current user is a member of
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("groups"),
      name: v.string(),
      description: v.optional(v.string()),
      totalBalance: v.number(),
      memberCount: v.number(),
      userBalance: v.number(),
      role: v.union(v.literal("admin"), v.literal("member")),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const groups = [];
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);
      if (!group) continue;

      const memberCount = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", membership.groupId))
        .collect()
        .then((members) => members.length);

      groups.push({
        _id: group._id,
        name: group.name,
        description: group.description,
        totalBalance: group.totalBalance,
        memberCount,
        userBalance: membership.balance,
        role: membership.role,
      });
    }

    return groups;
  },
});

/**
 * Get detailed information about a specific group
 */
export const get = query({
  args: {
    groupId: v.id("groups"),
  },
  returns: v.object({
    _id: v.id("groups"),
    name: v.string(),
    description: v.optional(v.string()),
    totalBalance: v.number(),
    members: v.array(
      v.object({
        userId: v.id("users"),
        balance: v.number(),
        role: v.union(v.literal("admin"), v.literal("member")),
        splitPercent: v.optional(v.number()),
      }),
    ),
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

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    return {
      _id: group._id,
      name: group.name,
      description: group.description,
      totalBalance: group.totalBalance,
      members: members.map((m) => ({
        userId: m.userId,
        balance: m.balance,
        role: m.role,
        splitPercent: m.splitPercent,
      })),
    };
  },
});

/**
 * Get a user's membership in a group
 */
export const getMembership = internalQuery({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .unique();
  },
});

/**
 * Join a group using an invitation
 */
export const joinGroup = mutation({
  args: {
    inviteId: v.id("invitations"),
  },
  handler: async (ctx, { inviteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user's email from auth
    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("User email not found");
    const email = user.email as string;

    // Validate the invite
    const validation = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "pending"),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .first();

    if (!validation) {
      throw new Error("No valid invitation found for your email");
    }
    if (validation._id !== inviteId) {
      throw new Error("Invalid invitation");
    }

    const groupId = validation.groupId;

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();

    if (existingMembership) {
      throw new Error("You are already a member of this group");
    }

    // Add user as a regular member
    await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      balance: 0,
      role: "member",
    });

    // Mark the invitation as accepted
    await ctx.db.patch(validation._id, {
      status: "accepted",
    });

    return groupId;
  },
});

/**
 * Update default split percentages for group members
 */
export const updateSplitPercents = mutation({
  args: {
    groupId: v.id("groups"),
    splits: v.array(
      v.object({
        userId: v.id("users"),
        splitPercent: v.number(),
      }),
    ),
  },
  handler: async (ctx, { groupId, splits }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user is an admin of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      throw new Error(
        "Must be a member of the group to update split percentages",
      );
    }

    // Validate total is 100%
    const total = splits.reduce((sum, split) => sum + split.splitPercent, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error("Split percentages must sum to 100%");
    }

    // Mark the group as having custom split ratios
    await ctx.db.patch(groupId, {
      customSplitRatio: true,
    });

    // Update each member's split percentage
    for (const split of splits) {
      const member = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_user", (q) =>
          q.eq("groupId", groupId).eq("userId", split.userId),
        )
        .unique();

      if (member) {
        await ctx.db.patch(member._id, {
          splitPercent: split.splitPercent,
        });
      }
    }
  },
});
