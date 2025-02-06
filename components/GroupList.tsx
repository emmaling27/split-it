"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

export default function GroupList() {
  const groups = useQuery(api.groups.list);

  if (!groups) {
    return null;
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">You haven't joined any groups yet.</p>
        <p className="text-gray-500">Create a group to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {groups.map((group) => (
        <Link
          key={group._id}
          href={`/groups/${group._id}`}
          className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">{group.name}</h2>
            <span
              className={`px-2 py-1 text-sm rounded ${
                group.role === "admin"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {group.role}
            </span>
          </div>

          {group.description && (
            <p className="text-gray-600 mb-4">{group.description}</p>
          )}

          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>{group.memberCount} members</span>
            <span
              className={`font-medium ${group.userBalance >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {group.userBalance >= 0 ? "You are owed" : "You owe"} $
              {Math.abs(group.userBalance).toFixed(2)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
