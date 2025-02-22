"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "./ui/use-toast";

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
  const [splitType, setSplitType] = useState<"default" | "custom">("default");
  const [customSplits, setCustomSplits] = useState<
    { userId: Id<"users">; amount: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const createExpense = useMutation(api.expenses.create);
  const group = useQuery(api.groups.get, { groupId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    setIsLoading(true);

    try {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) {
        toast({
          variant: "destructive",
          title: "Invalid amount",
          description: "Please enter a valid number for the amount.",
        });
        return;
      }

      let splits: Split[] = [];
      if (splitType === "default") {
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
          toast({
            variant: "destructive",
            title: "Invalid split amounts",
            description:
              "The split amounts must add up to the total expense amount.",
          });
          return;
        }
      }

      const response = await createExpense({
        groupId,
        description,
        amount: numericAmount,
        splitType,
        splits,
        note: note || undefined,
      });

      if (response.success) {
        setIsOpen(false);
        setDescription("");
        setAmount("");
        setNote("");
        setSplitType("default");
        setCustomSplits([]);
        toast({
          title: "Success",
          description: "Expense created successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to create expense",
          description: response.message,
        });
      }
    } catch (error) {
      // System errors
      console.error("System error:", error);
      toast({
        variant: "destructive",
        title: "System Error",
        description: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      setIsLoading(false);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Expense</DialogTitle>
          <DialogDescription>
            Add a new expense to split with your group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700"
            >
              Amount
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="splitType"
              className="block text-sm font-medium text-gray-700"
            >
              Split Type
            </label>
            <select
              id="splitType"
              name="splitType"
              value={splitType}
              onChange={(e) =>
                setSplitType(e.target.value as "default" | "custom")
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="equal">Default Split</option>
              <option value="custom">Custom Split</option>
            </select>
          </div>

          {splitType === "custom" && (
            <div className="space-y-2">
              {group.members.map((member) => (
                <div key={member.userId} className="flex items-center gap-2">
                  <span className="text-sm">User {member.userId}:</span>
                  <input
                    type="number"
                    value={
                      customSplits.find(
                        (split) => split.userId === member.userId,
                      )?.amount || ""
                    }
                    onChange={(e) =>
                      handleCustomSplitChange(member.userId, e.target.value)
                    }
                    step="0.01"
                    min="0"
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label
              htmlFor="note"
              className="block text-sm font-medium text-gray-700"
            >
              Note (optional)
            </label>
            <textarea
              id="note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
