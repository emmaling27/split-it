import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function UserDisplay({ userId }: { userId: Id<"users"> }) {
  const user = useQuery(api.users.get, { userId });

  if (!user) return <span className="text-gray-500">Loading...</span>;
  return <span>{user.email}</span>;
}
