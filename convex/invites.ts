import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { sendResend } from "./email";
import { CreateEmailResponse } from "resend";

const INVITE_EXPIRY_DAYS = 7;

type MutationResponse = {
  result: "success" | "error";
  message?: string;
};

export const sendInvite = action({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
  },
  handler: async (ctx, { groupId, email }): Promise<MutationResponse> => {
    try {
      // Get the authenticated user
      const userId = await getAuthUserId(ctx);
      if (!userId) throw new Error("Not authenticated");

      // Get group details
      const group = await ctx.runQuery(api.groups.get, { groupId });
      if (!group) throw new Error("Group not found");

      // Check if the user is a member of the group
      const membership = await ctx.runQuery(internal.groups.getMembership, {
        groupId,
        userId,
      });
      if (!membership) throw new Error("Not a member of this group");

      // Get inviter's email
      const inviter = await ctx.runQuery(api.users.get, { userId });
      if (!inviter) throw new Error("Inviter not found");

      // Check if there's already a pending invite
      const existingInvite = await ctx.runMutation(
        internal.invites.getOrCreateInvite,
        {
          groupId,
          email,
          invitedBy: userId,
        },
      );

      // Send the invite email using Resend
      const resendResponse: CreateEmailResponse = await sendResend(ctx, {
        to: email,
        subject: `Join ${group.name} on Split-it`,
        html: `
          <div>
            <h1>You've been invited to join ${group.name} on Split-it!</h1>
            <p>${membership.role === "admin" ? "Admin" : "Member"} ${inviter.email} has invited you to join their expense-sharing group.</p>
            <p>Click the link below to join:</p>
            <a href="${process.env.SITE_URL}/join-group/${existingInvite}">Join Group</a>
            <p>This invite link will expire in ${INVITE_EXPIRY_DAYS} days.</p>
          </div>
        `,
      });
      if (resendResponse.error) throw new Error("Failed to send invite");

      return {
        result: "success",
      };
    } catch (error) {
      return {
        result: "error",
        message:
          error instanceof Error ? error.message : "Failed to send invite",
      };
    }
  },
});

export const getOrCreateInvite = internalMutation({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
    invitedBy: v.id("users"),
  },
  handler: async (ctx, { groupId, email, invitedBy }) => {
    // Check for existing pending invite
    const existingInvite = await ctx.db
      .query("invitations")
      .withIndex("by_group_and_email", (q) =>
        q.eq("groupId", groupId).eq("email", email),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingInvite) {
      // Update expiry of existing invite
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      await ctx.db.patch(existingInvite._id, { expiresAt });
      return existingInvite._id;
    }

    // Create new invite
    return await ctx.db.insert("invitations", {
      groupId,
      email,
      invitedBy,
      status: "pending",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  },
});
