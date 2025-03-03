import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { createUser, setup } from "./test.setup";

describe("invites", () => {
  let t: ReturnType<typeof setup>;

  beforeEach(async () => {
    t = setup();
  });

  test("sending invites", async () => {
    const { userId, authSubject } = await createUser(t, {
      name: "User",
      email: "test@example.com",
    });

    const asUser = t.withIdentity({ subject: authSubject });

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
});
