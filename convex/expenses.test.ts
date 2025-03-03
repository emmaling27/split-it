import { convexTest } from "convex-test";
import { beforeEach, expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import { addMemberToGroup } from "./groups";
import { createUser, setup } from "./test.setup";

async function setupTestGroup(t: ReturnType<typeof convexTest>) {
  // Create a test user and group
  const { userId, authSubject } = await createUser(t, {
    name: "User",
    email: "test@example.com",
  });

  const asUser = t.withIdentity({ subject: authSubject });
  const groupId = await asUser.mutation(api.groups.create, {
    name: "Test Group",
  });

  // Create another test user for split testing
  const { userId: otherUserId } = await createUser(t, {
    name: "Other User",
    email: "other@example.com",
  });

  // Add the other user to the group
  await t.run(async (ctx) => {
    await addMemberToGroup(ctx, groupId, otherUserId);
  });

  return { userId, otherUserId, groupId, asUser };
}

describe("expenses", () => {
  let t: ReturnType<typeof setup>;

  beforeEach(async () => {
    t = setup();
  });

  test("creating and listing expenses", async () => {
    const { userId, otherUserId, groupId, asUser } = await setupTestGroup(t);

    // Create an expense with default split
    const createResult = await asUser.mutation(api.expenses.create, {
      groupId,
      description: "Test Expense",
      amount: 100,
      splitType: "default",
      splits: [],
      note: "Test note",
    });
    if (!createResult.success) {
      throw new Error(`Failed to create expense: ${createResult.message}`);
    }

    // List expenses and verify
    const result = await asUser.query(api.expenses.listByGroup, {
      groupId,
      showSettled: false,
    });

    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0]).toMatchObject({
      description: "Test Expense",
      amount: 100,
      note: "Test note",
      status: "active",
      paidBy: userId,
    });

    // Verify splits
    expect(result.expenses[0].splits).toHaveLength(2);
    expect(result.expenses[0].splits).toContainEqual(
      expect.objectContaining({
        userId: userId,
        amount: 50,
        settled: false,
      }),
    );
    expect(result.expenses[0].splits).toContainEqual(
      expect.objectContaining({
        userId: otherUserId,
        amount: 50,
        settled: false,
      }),
    );
  });

  test("creating expense with custom split", async () => {
    const { userId, otherUserId, groupId, asUser } = await setupTestGroup(t);

    // Create an expense with custom split
    const createResult = await asUser.mutation(api.expenses.create, {
      groupId,
      description: "Custom Split Expense",
      amount: 100,
      splitType: "custom",
      splits: [
        { userId: userId, amount: 30 },
        { userId: otherUserId, amount: 70 },
      ],
    });
    if (!createResult.success) {
      throw new Error(`Failed to create expense: ${createResult.message}`);
    }

    // Verify the splits
    const result = await asUser.query(api.expenses.listByGroup, {
      groupId,
      showSettled: false,
    });

    expect(result.expenses[0].splits).toContainEqual(
      expect.objectContaining({
        userId: userId,
        amount: 30,
        settled: false,
      }),
    );
    expect(result.expenses[0].splits).toContainEqual(
      expect.objectContaining({
        userId: otherUserId,
        amount: 70,
        settled: false,
      }),
    );
  });

  test("settling expense splits", async () => {
    const { userId, otherUserId, groupId, asUser } = await setupTestGroup(t);

    // Create an expense
    const createResult = await asUser.mutation(api.expenses.create, {
      groupId,
      description: "Expense to Settle",
      amount: 100,
      splitType: "default",
      splits: [],
    });
    if (!createResult.success) {
      throw new Error(`Failed to create expense: ${createResult.message}`);
    }

    // Settle one user's split
    const settleResult = await asUser.mutation(api.expenses.settleExpense, {
      expenseId: createResult.value,
      userId: otherUserId,
    });
    if (!settleResult.success) {
      throw new Error(`Failed to settle expense: ${settleResult.message}`);
    }

    // Verify the settlement
    const result = await asUser.query(api.expenses.listByGroup, {
      groupId,
      showSettled: false,
    });

    const expense = result.expenses[0];
    const settledSplit = expense.splits.find(
      (split) => split.userId === otherUserId,
    );
    const unsettledSplit = expense.splits.find(
      (split) => split.userId === userId,
    );

    expect(settledSplit?.settled).toBe(true);
    expect(unsettledSplit?.settled).toBe(false);
    expect(expense.status).toBe("active"); // Still active because not all splits are settled
  });

  test("settling entire group", async () => {
    const { groupId, asUser } = await setupTestGroup(t);

    // Create a couple of expenses
    const expense1Result = await asUser.mutation(api.expenses.create, {
      groupId,
      description: "Expense 1",
      amount: 100,
      splitType: "default",
      splits: [],
    });
    if (!expense1Result.success) {
      throw new Error(`Failed to create expense 1: ${expense1Result.message}`);
    }

    const expense2Result = await asUser.mutation(api.expenses.create, {
      groupId,
      description: "Expense 2",
      amount: 50,
      splitType: "default",
      splits: [],
    });
    if (!expense2Result.success) {
      throw new Error(`Failed to create expense 2: ${expense2Result.message}`);
    }

    // Settle the entire group
    const settleResult = await asUser.mutation(api.expenses.settleGroup, {
      groupId,
    });
    if (!settleResult.success) {
      throw new Error(`Failed to settle group: ${settleResult.message}`);
    }

    // Verify all expenses are settled
    const result = await asUser.query(api.expenses.listByGroup, {
      groupId,
      showSettled: true,
    });

    expect(
      result.expenses.every((expense) => expense.status === "settled"),
    ).toBe(true);
    expect(
      result.expenses.every((expense) =>
        expense.splits.every((split) => split.settled),
      ),
    ).toBe(true);
  });

  test("deleting expense", async () => {
    const { groupId, asUser } = await setupTestGroup(t);

    // Create an expense
    const createResult = await asUser.mutation(api.expenses.create, {
      groupId,
      description: "Expense to Delete",
      amount: 100,
      splitType: "default",
      splits: [],
    });
    if (!createResult.success) {
      throw new Error(`Failed to create expense: ${createResult.message}`);
    }

    // Delete the expense
    const deleteResult = await asUser.mutation(api.expenses.deleteExpense, {
      expenseId: createResult.value,
    });
    if (!deleteResult.success) {
      throw new Error(`Failed to delete expense: ${deleteResult.message}`);
    }

    // Verify the expense is gone
    const result = await asUser.query(api.expenses.listByGroup, {
      groupId,
      showSettled: true,
    });

    expect(result.expenses).toHaveLength(0);
  });
});
