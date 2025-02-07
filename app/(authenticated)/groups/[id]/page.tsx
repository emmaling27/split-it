import { Suspense } from "react";
import { Id } from "@/convex/_generated/dataModel";
import GroupHeader from "@/components/GroupHeader";
import ExpenseList from "@/components/ExpenseList";
import CreateExpenseButton from "@/components/CreateExpenseButton";
import InviteButton from "@/components/InviteButton";
import SettleGroupButton from "@/components/SettleGroupButton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function GroupPage({
  params,
}: {
  params: { id: Id<"groups"> };
}) {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/groups">
          <Button variant="ghost" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Groups
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div>Loading group details...</div>}>
        <GroupHeader groupId={params.id} />
      </Suspense>

      <div className="flex justify-between items-center my-8">
        <h2 className="text-2xl font-semibold">Expenses</h2>
        <div className="flex gap-4">
          <SettleGroupButton groupId={params.id} />
          <InviteButton groupId={params.id} />
          <CreateExpenseButton groupId={params.id} />
        </div>
      </div>

      <Suspense fallback={<div>Loading expenses...</div>}>
        <ExpenseList groupId={params.id} />
      </Suspense>
    </main>
  );
}
