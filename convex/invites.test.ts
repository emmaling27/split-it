import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

let testUserId: string = "1;users";

// Mock the getAuthUserId function because convex-auth assumes an id format incompatible with convex-test
vi.mock("@convex-dev/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@convex-dev/auth/server")>();
  return {
    ...actual,
    getAuthUserId: vi.fn().mockImplementation(() => testUserId),
  };
});

test("sending invites", async () => {
  const t = convexTest(schema);

  const userId = await t.run(async (ctx) => {
    return ctx.db.insert("users", { name: "User", email: "test@example.com" });
  });
  testUserId = userId;

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
