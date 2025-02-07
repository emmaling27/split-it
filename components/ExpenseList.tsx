"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import UserDisplay from "./UserDisplay";
import { Button } from "./ui/button";

export default function ExpenseList({ groupId }: { groupId: Id<"groups"> }) {
  const [showSettled, setShowSettled] = useState(false);
  const result = useQuery(api.expenses.listByGroup, {
    groupId,
    showSettled,
  });

  if (!result) {
    return null;
  }

  const { expenses, hasSettled } = result;

  if (expenses.length === 0 && !hasSettled) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No expenses yet.</p>
        <p className="text-gray-500">Create an expense to get started!</p>
      </div>
    );
  }

  if (expenses.length === 0 && hasSettled) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No active expenses.</p>
        <Button
          variant="outline"
          onClick={() => setShowSettled(true)}
          className="mt-4"
        >
          Show Settled Expenses
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4 mb-8">
        {expenses.map((expense) => (
          <div key={expense._id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">
                  {expense.description}
                </h3>
                {expense.note && (
                  <p className="text-gray-600 text-sm">{expense.note}</p>
                )}
                <p className="text-sm text-gray-500">
                  Paid by <UserDisplay userId={expense.paidBy} />
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-600">
                  ${expense.amount.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(expense.date).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2">
                Split Details ({expense.splitType})
              </h4>
              <div className="space-y-2">
                {expense.splits.map((split) => (
                  <div
                    key={split.userId}
                    className="flex justify-between items-center"
                  >
                    <UserDisplay userId={split.userId} />
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        ${split.amount.toFixed(2)}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          split.settled
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {split.settled ? "Settled" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(hasSettled || showSettled) && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShowSettled(!showSettled)}
            className="text-gray-600"
          >
            {showSettled ? "Hide Settled Expenses" : "Show Settled Expenses"}
          </Button>
        </div>
      )}
    </div>
  );
}
