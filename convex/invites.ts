import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { sendResend } from "./email";
import { CreateEmailResponse } from "resend";

export const sendInvite = action({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
  },
  handler: async (ctx, { groupId, email }): Promise<void> => {
    // Get the authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get group details
    const group = (await ctx.runQuery(api.groups.get, {
      groupId,
    })) as Doc<"groups"> & {
      members: Array<{
        userId: Doc<"users">["_id"];
        balance: number;
        role: "admin" | "member";
      }>;
    };
    if (!group) throw new Error("Group not found");

    // Check if the user is a member of the group
    const membership = (await ctx.runQuery(internal.groups.getMembership, {
      groupId,
      userId,
    })) as Doc<"groupMembers"> | null;
    if (!membership) throw new Error("Not a member of this group");

    // Send the invite email using Resend
    const resendResponse: CreateEmailResponse = await sendResend(ctx, {
      to: email,
      subject: `Join ${group.name} on Split-it`,
      html: `
        <div>
          <h1>You've been invited to join ${group.name} on Split-it!</h1>
          <p>${membership.role === "admin" ? "Admin" : "Member"} ${userId} has invited you to join their expense-sharing group.</p>
          <p>Click the link below to join:</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/join-group/${groupId}">Join Group</a>
        </div>
      `,
    });
    if (resendResponse.error) throw new Error("Resend failed to send invite");
  },
});
