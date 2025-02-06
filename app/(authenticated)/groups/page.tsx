import { Suspense } from "react";
import GroupList from "@/components/GroupList";
import CreateGroupButton from "@/components/CreateGroupButton";

export default function GroupsPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Groups</h1>
        <CreateGroupButton />
      </div>
      <Suspense fallback={<div>Loading groups...</div>}>
        <GroupList />
      </Suspense>
    </main>
  );
}
