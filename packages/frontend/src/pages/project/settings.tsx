import { useEffect, useState } from "react";
import { PageHeader } from "@/components/molecules/page-header";
import { Button } from "@/components/atoms/button";
import { EditBudgetDrawer } from "@/components/molecules/edit-budget-drawer";
import { useProjectContext } from "@/layouts/project-layout";
import { useUpdateProjectCurrency } from "@/hooks/use-projects";
import { formatCurrency } from "@/lib/formatters";
import { SUPPORTED_CURRENCIES, currencyLabel } from "@/lib/currency";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/api-error";

export default function ProjectSettings() {
  const { project, access } = useProjectContext();
  const [editOpen, setEditOpen] = useState(false);
  const canManage = access?.capabilities?.canManage ?? false;

  const [currency, setCurrency] = useState<string>(project.currency);
  useEffect(() => setCurrency(project.currency), [project.currency]);
  const updateCurrency = useUpdateProjectCurrency(project.id);
  const currencyDirty = currency !== project.currency;

  const hasRange = project.budgetMin !== null && project.budgetMax !== null;
  const rangeLabel = hasRange
    ? `${formatCurrency(project.budgetMin!, project.currency, { compact: true })} – ${formatCurrency(project.budgetMax!, project.currency, { compact: true })}`
    : formatCurrency(project.budgetTotal, project.currency, { compact: true });

  return (
    <div className="flex w-full flex-col px-6 py-8 sm:px-10">
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

      <section className="mt-6 rounded-2xl border border-[#F0F0F0] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Currency</h2>
            <p className="mt-1 text-sm text-gray-500 text-pretty">
              The currency used for budgets, finances, materials and estimates on this
              project. New projects inherit your organisation's default currency.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-currency" className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Project currency
            </label>
            <select
              id="project-currency"
              value={currency}
              disabled={!canManage}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 w-72 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:opacity-60"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {currencyLabel(c.code)}
                </option>
              ))}
            </select>
          </div>
          {canManage && (
            <Button
              variant="primary"
              size="md"
              loading={updateCurrency.isPending}
              disabled={!currencyDirty}
              onClick={() =>
                updateCurrency.mutate(currency, {
                  onSuccess: () => toast("Project currency updated.", "success"),
                  onError: (e) => toast(getApiErrorMessage(e, "Could not update currency."), "error"),
                })
              }
            >
              Save currency
            </Button>
          )}
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
