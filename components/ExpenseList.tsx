"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import UserDisplay from "./UserDisplay";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "./ui/use-toast";

interface Expense {
  _id: Id<"expenses">;
  _creationTime: number;
  description: string;
  amount: number;
  date: number;
  paidBy: Id<"users">;
  splitType: "default" | "custom";
  note?: string;
  status: "active" | "settled";
  splits: Array<{
    userId: Id<"users">;
    amount: number;
    settled: boolean;
  }>;
}

interface ExpenseListProps {
  expenses: Expense[];
  hasSettled: boolean;
  showSettled: boolean;
  onToggleSettled: () => void;
}

export default function ExpenseList({
  expenses,
  hasSettled,
  showSettled,
  onToggleSettled,
}: ExpenseListProps) {
  const { toast } = useToast();
  const deleteExpense = useMutation(api.expenses.deleteExpense);

  const handleDelete = async (expenseId: Id<"expenses">) => {
    try {
      await deleteExpense({ expenseId });
      toast({
        title: "Expense deleted",
        description: "The expense has been successfully deleted.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete expense",
        description:
          error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

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
        <Button variant="outline" onClick={onToggleSettled} className="mt-4">
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
              <div className="flex items-start gap-4">
                <div className="text-right">
                  <div className="text-lg font-semibold text-green-600">
                    ${expense.amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(expense.date).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-red-600 -mt-1"
                  onClick={() => handleDelete(expense._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
            onClick={onToggleSettled}
            className="text-gray-600"
          >
            {showSettled ? "Hide Settled Expenses" : "Show Settled Expenses"}
          </Button>
        </div>
      )}
    </div>
  );
}
