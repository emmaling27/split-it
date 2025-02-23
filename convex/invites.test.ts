import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAuthMock } from "../lib/auth";

const authMock = setupAuthMock();

test("sending invites", async () => {
  const t = convexTest(schema);

  const userId = await t.run(async (ctx) => {
    return ctx.db.insert("users", { name: "User", email: "test@example.com" });
  });
  authMock.setMockUserId(userId);

  const asUser = t.withIdentity({ name: "User" });

  // Create a group which will create the user
  const groupId = await asUser.mutation(api.groups.create, {
    name: "Test Group",
  });
  expect(groupId).toBeDefined();

  // Test creating an invite
  const invite = await asUser.mutation(internal.invites.getOrCreateInvite, {
    groupId,
    email: "invited@example.com",
    invitedBy: userId,
  });

  expect(invite).toMatchObject({
    groupName: "Test Group",
    inviterEmail: "test@example.com",
    isAdmin: true, // First user in a group is admin
  });
  expect(invite.inviteId).toBeDefined();
});
