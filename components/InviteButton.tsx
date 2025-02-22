"use client";
import { useState } from "react";
import { useAction } from "convex/react";
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

// Helper function for handling mutation errors
function handleMutationError(
  error: unknown,
  toast: ReturnType<typeof useToast>["toast"],
) {
  if (!error) return;

  // Handle specific error responses from the mutation
  if (
    typeof error === "object" &&
    error !== null &&
    "success" in error &&
    !error.success &&
    "message" in error
  ) {
    toast({
      variant: "destructive",
      title: "Error",
      description: error.message as string,
      duration: 5000,
    });
    return;
  }

  // Handle system/unexpected errors
  toast({
    variant: "destructive",
    title: "System Error",
    description: "An unexpected error occurred. Please try again later.",
    duration: 5000,
  });
}

export default function InviteButton({ groupId }: { groupId: Id<"groups"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const sendInvite = useAction(api.invites.sendInvite);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await sendInvite({
        groupId,
        email,
      });

      if (result.success) {
        setIsOpen(false);
        setEmail("");
        // Keep a minimal success toast for invite confirmation
        toast({
          title: "Invitation sent",
          description: `Sent to ${email}`,
          duration: 3000,
        });
      } else {
        handleMutationError(result, toast);
      }
    } catch (error) {
      handleMutationError(error, toast);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Invite Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to Group</DialogTitle>
          <DialogDescription>
            Send an invitation to join your group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
