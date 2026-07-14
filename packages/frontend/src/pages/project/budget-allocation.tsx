import { useState } from "react";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { Button } from "@/components/atoms/button";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertBudgetCategoryDialog,
  type UpsertBudgetCategoryValues,
} from "@/components/molecules/upsert-budget-category-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useCreateBudgetCategory } from "@/hooks/use-budget";
import { useProjectFinances } from "@/hooks/use-finances";
import { canResourceAction } from "@/lib/project-types";

import { AllocationBreakdown } from "./budget-allocation/allocation-breakdown";
import { PlannedVsActualChart } from "./budget-allocation/planned-vs-actual-chart";

// ── Helpers ───────────────────────────────────────────────────────────────
function toCategoryInput(values: UpsertBudgetCategoryValues) {
  return {
    name: values.name,
    costCode: values.costCode || undefined,
    planned: values.planned ? Number(values.planned) : undefined,
    committed: values.committed ? Number(values.committed) : undefined,
    actual: values.actual ? Number(values.actual) : undefined,
    notes: values.notes || undefined,
  };
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ProjectBudgetAllocation() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const { data: finances, isPending } = useProjectFinances(project.id);
  const createCategory = useCreateBudgetCategory();
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreate(values: UpsertBudgetCategoryValues): void {
    createCategory.mutate(
      { projectId: project.id, ...toCategoryInput(values) },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  if (isPending || !finances) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Budget Allocation & Analysis" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Budget Allocation & Analysis"
        description="Create budget categories, then track planned vs actual allocation by phase."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon className="size-4" /> Add budget allocation
            </Button>
          ) : undefined
        }
      />

      <UpsertBudgetCategoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createCategory.isPending}
        error={(createCategory.error as Error | undefined)?.message ?? null}
        currency={finances.currency}
      />

      <div className="mt-8 flex flex-col gap-5">
        {finances.budgetAllocation.length === 0 ? (
          <Card className="rounded-[16px] border-none bg-[#F8F8F8]">
            <EmptyState
              icon={<FinancesIcon className="h-6 w-6" />}
              title="No budget allocation yet"
              description="Add your first budget category to start allocation and variance tracking."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setCreateOpen(true)}
                  >
                    <PlusIcon className="size-4" /> Add budget allocation
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            <AllocationBreakdown
              allocation={finances.budgetAllocation}
              currency={finances.currency}
              className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
            />

            <PlannedVsActualChart
              allocation={finances.budgetAllocation}
              currency={finances.currency}
              className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
            />
          </>
        )}
      </div>
    </div>
  );
}
