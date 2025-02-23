import { useToast } from "@/components/ui/use-toast";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export type MutationResult<T> =
  | { success: true; value: T }
  | { success: false; message: string };

// Helper function for handling mutation errors
export function handleMutationError(
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
