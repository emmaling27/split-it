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
import { useToast } from "./ui/use-toast";

export default function SettleGroupButton({
  groupId,
}: {
  groupId: Id<"groups">;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const settleGroup = useMutation(api.expenses.settleGroup);
  const { toast } = useToast();

  const handleSettle = async () => {
    try {
      setIsLoading(true);
      const response = await settleGroup({ groupId });
      if (response.success) {
        toast({
          title: "Group settled",
          description:
            "All expenses have been marked as settled and balances have been reset.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to settle group",
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
