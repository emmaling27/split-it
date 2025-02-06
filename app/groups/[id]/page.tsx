import { Suspense } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import GroupHeader from "../../../components/GroupHeader";
import ExpenseList from "../../../components/ExpenseList";
import CreateExpenseButton from "../../../components/CreateExpenseButton";

export default function GroupPage({ params }: { params: { id: string } }) {
  const groupId = params.id as Id<"groups">;

  return (
    <main className="container mx-auto px-4 py-8">
      <Suspense fallback={<div>Loading group...</div>}>
        <GroupHeader groupId={groupId} />
      </Suspense>

      <div className="flex justify-between items-center my-8">
        <h2 className="text-2xl font-semibold">Expenses</h2>
        <CreateExpenseButton groupId={groupId} />
      </div>

      <Suspense fallback={<div>Loading expenses...</div>}>
        <ExpenseList groupId={groupId} />
      </Suspense>
    </main>
  );
}
