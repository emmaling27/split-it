"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Split = {
  userId: Id<"users">;
  amount: number;
};

export default function CreateExpenseButton({
  groupId,
}: {
  groupId: Id<"groups">;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customSplits, setCustomSplits] = useState<
    { userId: Id<"users">; amount: string }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createExpense = useMutation(api.expenses.create);
  const group = useQuery(api.groups.get, { groupId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    setIsSubmitting(true);

    try {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) throw new Error("Invalid amount");

      let splits: Split[] = [];
      if (splitType === "equal") {
        // The backend will handle equal splits
        splits = [];
      } else {
        // Validate custom splits
        splits = customSplits.map((split) => ({
          userId: split.userId,
          amount: parseFloat(split.amount),
        }));

        const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
        if (Math.abs(totalSplit - numericAmount) > 0.01) {
          throw new Error("Split amounts must sum to the total amount");
        }
      }

      await createExpense({
        groupId,
        description,
        amount: numericAmount,
        splitType,
        splits,
        note: note || undefined,
      });

      setIsOpen(false);
      setDescription("");
      setAmount("");
      setNote("");
      setSplitType("equal");
      setCustomSplits([]);
    } catch (error) {
      console.error("Failed to create expense:", error);
      alert("Failed to create expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSplitChange = (userId: Id<"users">, value: string) => {
    setCustomSplits((prev) => {
      const existing = prev.find((split) => split.userId === userId);
      if (existing) {
        return prev.map((split) =>
          split.userId === userId ? { ...split, amount: value } : split,
        );
      }
      return [...prev, { userId, amount: value }];
    });
  };

  if (!group) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Add Expense
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create New Expense</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Amount
                </label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="splitType"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Split Type
                </label>
                <select
                  id="splitType"
                  value={splitType}
                  onChange={(e) =>
                    setSplitType(e.target.value as "equal" | "custom")
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="equal">Equal Split</option>
                  <option value="custom">Custom Split</option>
                </select>
              </div>

              {splitType === "custom" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Split Amounts
                  </label>
                  <div className="space-y-2">
                    {group.members.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-2"
                      >
                        <span className="text-sm">User {member.userId}:</span>
                        <input
                          type="number"
                          value={
                            customSplits.find(
                              (split) => split.userId === member.userId,
                            )?.amount || ""
                          }
                          onChange={(e) =>
                            handleCustomSplitChange(
                              member.userId,
                              e.target.value,
                            )
                          }
                          step="0.01"
                          min="0"
                          className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label
                  htmlFor="note"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Note (Optional)
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
