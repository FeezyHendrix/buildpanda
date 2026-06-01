import { useState } from "react";
import { PageHeader } from "@/components/molecules/page-header";
import { Button } from "@/components/atoms/button";
import { EditBudgetDrawer } from "@/components/molecules/edit-budget-drawer";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCurrency } from "@/lib/formatters";

export default function ProjectSettings() {
  const { project } = useProjectContext();
  const [editOpen, setEditOpen] = useState(false);

  const hasRange = project.budgetMin !== null && project.budgetMax !== null;
  const rangeLabel = hasRange
    ? `${formatCurrency(project.budgetMin!, project.currency, { compact: true })} – ${formatCurrency(project.budgetMax!, project.currency, { compact: true })}`
    : formatCurrency(project.budgetTotal, project.currency, { compact: true });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10">
      <PageHeader
        title="Settings"
        description="Configure project preferences, notification rules, and team access."
      />

      <section className="rounded-2xl border border-[#F0F0F0] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Project budget</h2>
            <p className="mt-1 text-sm text-gray-500 text-pretty">
              The estimated budget range for this project. Used as the headline
              budget across dashboards.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[#FAFAFA] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Budget range
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{rangeLabel}</p>
          </div>
          <div className="rounded-xl bg-[#FAFAFA] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total budget
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(project.budgetTotal, project.currency, { compact: true })}
            </p>
          </div>
        </div>
      </section>

      <EditBudgetDrawer
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
