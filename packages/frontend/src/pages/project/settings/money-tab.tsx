import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { useUpdateProjectCurrency } from "@/hooks/use-projects";
import { SUPPORTED_CURRENCIES, currencyLabel } from "@/lib/currency";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/project-types";
import { SettingsCard } from "./settings-tabs";

interface MoneyTabProps {
  project: Project;
  canManage: boolean;
  onEditBudget: () => void;
}

/**
 * The headline figure and the currency. Everything else commercial — contract
 * terms, retention, LDs, VAT — lives on the contract itself, so this links out
 * rather than growing a second place to type the same numbers.
 */
function MoneyTab({ project, canManage, onEditBudget }: MoneyTabProps) {
  const [currency, setCurrency] = useState<string>(project.currency);
  useEffect(() => setCurrency(project.currency), [project.currency]);
  const updateCurrency = useUpdateProjectCurrency(project.id);
  const currencyDirty = currency !== project.currency;

  const hasRange = project.budgetMin !== null && project.budgetMax !== null;
  const rangeLabel = hasRange
    ? `${formatCurrency(project.budgetMin!, project.currency, { compact: true })} – ${formatCurrency(project.budgetMax!, project.currency, { compact: true })}`
    : formatCurrency(project.budgetTotal, project.currency, { compact: true });

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard
        title="Budget / contract sum"
        description="The headline figure dashboards quote. A signed contract sum is one number; the range is for a job still being scoped."
        action={
          canManage ? (
            <Button variant="ghost" size="sm" onClick={onEditBudget}>
              Edit
            </Button>
          ) : undefined
        }
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-alt px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Budget range</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{rangeLabel}</p>
          </div>
          <div className="rounded-lg bg-surface-alt px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total budget</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(project.budgetTotal, project.currency, { compact: true })}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Retention, advance recovery, liquidated damages, VAT and payment terms belong to the
          contract itself —{" "}
          <Link
            to={`/project/${project.id}/finances/contracts-phases`}
            className="font-medium text-primary-600 hover:underline"
          >
            Finance → Contracts &amp; phases
          </Link>
          .
        </p>
      </SettingsCard>

      <SettingsCard
        title="Currency"
        description="Used for budgets, finances, materials and estimates on this project. New projects inherit your organisation's default."
      >
        {canManage ? (
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-currency"
                className="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Project currency
              </label>
              <select
                id="project-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={cn(INPUT_CLASS, "w-72")}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {currencyLabel(c.code)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={updateCurrency.isPending}
              disabled={!currencyDirty}
              onClick={() =>
                updateCurrency.mutate(currency, {
                  onSuccess: () => toast("Project currency updated.", "success"),
                  onError: (e) => toast(errorMessage(e, "Could not update currency."), "error"),
                })
              }
            >
              Save currency
            </Button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-gray-500">{currencyLabel(project.currency)}</p>
        )}
      </SettingsCard>
    </div>
  );
}

MoneyTab.displayName = "MoneyTab";

export { MoneyTab, type MoneyTabProps };
