import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { sendResend } from "./email";
import { CreateEmailResponse } from "resend";
import { Id } from "./_generated/dataModel";
import { MutationResponse } from "./validators";

const INVITE_EXPIRY_DAYS = 7;

type ValidInvite = {
  valid: true;
  groupId: Id<"groups">;
};

type InvalidInvite = {
  valid: false;
  message: string;
};

export const get = query({
  args: {
    inviteId: v.id("invitations"),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      groupId: v.id("groups"),
    }),
    v.object({
      valid: v.literal(false),
      message: v.string(),
    }),
  ),
  handler: async (ctx, { inviteId }): Promise<ValidInvite | InvalidInvite> => {
    const invite = await ctx.db.get(inviteId);
    if (!invite) {
      return { valid: false, message: "Invitation not found" };
    }

    if (invite.expiresAt < Date.now()) {
      return { valid: false, message: "Invitation has expired" };
    }

    if (invite.status === "accepted") {
      return { valid: false, message: "Invitation has already been used" };
    }

    return { valid: true, groupId: invite.groupId };
  },
});

export const getOrCreateInvite = internalMutation({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
    invitedBy: v.id("users"),
  },
  returns: v.object({
    inviteId: v.id("invitations"),
    groupName: v.string(),
    inviterEmail: v.string(),
    isAdmin: v.boolean(),
  }),
  handler: async (
    ctx,
    { groupId, email, invitedBy },
  ): Promise<{
    inviteId: Id<"invitations">;
    groupName: string;
    inviterEmail: string;
    isAdmin: boolean;
  }> => {
    // Validate group and membership first
    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Group not found");

    // Check if the user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", invitedBy),
      )
      .unique();
    if (!membership) throw new Error("Not a member of this group");

    // Get inviter's email for the invite message
    const inviter = await ctx.db.get(invitedBy);
    if (!inviter?.email) throw new Error("Inviter not found");

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
      const expiresAt = Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      await ctx.db.patch(existingInvite._id, { expiresAt });
      return {
        inviteId: existingInvite._id,
        groupName: group.name,
        inviterEmail: inviter.email,
        isAdmin: membership.role === "admin",
      };
    }

    // Create new invite
    const inviteId = await ctx.db.insert("invitations", {
      groupId,
      email,
      invitedBy,
      status: "pending",
      expiresAt: Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    return {
      inviteId,
      groupName: group.name,
      inviterEmail: inviter.email,
      isAdmin: membership.role === "admin",
    };
  },
});

export const sendInvite = action({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
  },
  returns: MutationResponse(v.null()),
  handler: async (
    ctx,
    { groupId, email },
  ): Promise<
    { success: true; value: null } | { success: false; message: string }
  > => {
    try {
      // Get the authenticated user
      const userId = await getAuthUserId(ctx);
      if (!userId) throw new Error("Not authenticated");

      // Create or get the invite and validate access in a single transaction
      const { inviteId, groupName, inviterEmail, isAdmin } =
        await ctx.runMutation(internal.invites.getOrCreateInvite, {
          groupId,
          email,
          invitedBy: userId,
        });

      // Send the invite email using Resend
      const resendResponse: CreateEmailResponse = await sendResend(ctx, {
        to: email,
        subject: `Join ${groupName} on Split-it`,
        html: `
          <div>
            <h1>You've been invited to join ${groupName} on Split-it!</h1>
            <p>${isAdmin ? "Admin" : "Member"} ${inviterEmail} has invited you to join their expense-sharing group.</p>
            <p>Click the link below to join:</p>
            <a href="${process.env.SITE_URL}/join-group/${inviteId}">Join Group</a>
            <p>This invite link will expire in ${INVITE_EXPIRY_DAYS} days.</p>
          </div>
        `,
      });
      if (resendResponse.error) throw new Error("Failed to send invite");

      return { success: true, value: null };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to send invite",
      };
    }
  },
});
