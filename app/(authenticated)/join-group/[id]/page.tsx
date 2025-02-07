"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

export default function JoinGroupPage() {
  const router = useRouter();
  const { id } = useParams();
  const inviteId = id as Id<"invitations">;
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const joinGroup = useMutation(api.groups.joinGroup);

  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);

    try {
      const groupId = await joinGroup({ inviteId });
      router.push(`/groups/${groupId}`);
    } catch (error) {
      console.error("Failed to join group:", error);
      setError(error instanceof Error ? error.message : "Failed to join group");
      setIsJoining(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Join Group</h1>

        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            Invalid or Expired Invitation
          </h1>
          <p className="text-gray-600 mb-4">
            We could not find a valid invitation for your email. The invitation
            might have expired or does not match your account email address.
          </p>
          <p className="text-gray-600">
            Please ask for a new invitation from the group admin.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isJoining ? "Joining..." : "Join Group"}
          </button>
        </div>
      </div>
    </main>
  );
}
