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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: PageProps) {
  const { id } = await params;
  const groupId = id as Id<"groups">;

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
        <GroupHeader groupId={groupId} />
      </Suspense>

      <div className="flex justify-between items-center my-8">
        <h2 className="text-2xl font-semibold">Expenses</h2>
        <div className="flex gap-4">
          <SettleGroupButton groupId={groupId} />
          <InviteButton groupId={groupId} />
          <CreateExpenseButton groupId={groupId} />
        </div>
      </div>

      <Suspense fallback={<div>Loading expenses...</div>}>
        <ExpenseList groupId={groupId} />
      </Suspense>
    </main>
  );
}
