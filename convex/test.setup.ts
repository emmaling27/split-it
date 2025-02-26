import { convexTest } from "convex-test";
import schema from "./schema";
import { Doc } from "./_generated/dataModel";

export function setup() {
  const t = convexTest(schema);
  return t;
}

export async function createUser(
  t: ReturnType<typeof convexTest>,
  user: Partial<Doc<"users">>,
) {
  const { userId, sessionId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", user);
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 1000 * 60 * 60 * 24 * 30,
    });
    return { userId, sessionId };
  });
  const authSubject = `${userId}|${sessionId}`;
  return { userId, sessionId, authSubject };
}
