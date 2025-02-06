"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import UserDisplay from "./UserDisplay";

export default function GroupHeader({ groupId }: { groupId: Id<"groups"> }) {
  const group = useQuery(api.groups.get, { groupId });

  if (!group) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
          {group.description && (
            <p className="text-gray-600">{group.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold mb-1">
            Total Balance: ${group.totalBalance.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">
            {group.members.length} members
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {group.members.map((member) => (
            <div
              key={member.userId}
              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  {member.role === "admin" ? "A" : "M"}
                </div>
                <UserDisplay userId={member.userId} />
              </div>
              <span
                className={`font-medium ${
                  member.balance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ${member.balance.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
