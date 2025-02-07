"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import UserDisplay from "./UserDisplay";

type Member = {
  userId: Id<"users">;
  splitPercent?: number;
};

export default function SplitPercentEditor({
  groupId,
  members,
}: {
  groupId: Id<"groups">;
  members: Member[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSplits, setEditedSplits] = useState<Record<
    string,
    number
  > | null>(null);

  const updateSplits = useMutation(api.groups.updateSplitPercents);

  const splits =
    editedSplits ??
    Object.fromEntries(members.map((m) => [m.userId, m.splitPercent ?? 0]));

  const totalPercent = Object.values(splits).reduce((sum, v) => sum + v, 0);

  const handleSave = async () => {
    if (Math.abs(totalPercent - 100) > 0.01) {
      setError("Split percentages must sum to 100%");
      return;
    }

    try {
      await updateSplits({
        groupId,
        splits: Object.entries(splits).map(([userId, percent]) => ({
          userId: userId as Id<"users">,
          splitPercent: percent,
        })),
      });
      setIsEditing(false);
      setEditedSplits(null);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to update splits",
      );
    }
  };

  if (!isEditing) {
    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Default Split Ratios</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex justify-between items-center"
            >
              <UserDisplay userId={member.userId} />
              <span className="text-gray-600">
                {member.splitPercent?.toFixed(1) ?? 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">Edit Default Split Ratios</h3>
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.userId} className="flex items-center gap-4">
            <div className="flex-1">
              <UserDisplay userId={member.userId} />
            </div>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={splits[member.userId]}
              onChange={(e) =>
                setEditedSplits({
                  ...splits,
                  [member.userId]: parseFloat(e.target.value) || 0,
                })
              }
              className="w-20 px-2 py-1 border rounded"
            />
            <span className="text-gray-600">%</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <span className="text-sm">Total: {totalPercent.toFixed(1)}%</span>
          {error && <span className="ml-2 text-sm text-red-600">{error}</span>}
        </div>
        <div className="space-x-2">
          <button
            onClick={() => {
              setIsEditing(false);
              setEditedSplits(null);
            }}
            className="px-3 py-1 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
