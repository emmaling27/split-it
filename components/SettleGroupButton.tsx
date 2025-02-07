"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SettleGroupButton({
  groupId,
}: {
  groupId: Id<"groups">;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const settleGroup = useMutation(api.expenses.settleGroup);

  const handleSettle = async () => {
    try {
      setIsLoading(true);
      await settleGroup({ groupId });
    } catch (error) {
      console.error("Failed to settle group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="default"
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={isLoading}
        >
          {isLoading ? "Settling up..." : "Settle Up Group"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Settle Up Group</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark all expenses as settled and reset all balances to
            zero. This action cannot be undone. Are you sure you want to
            continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSettle}>
            Yes, settle up
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
