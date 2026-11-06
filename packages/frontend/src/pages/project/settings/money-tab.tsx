import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Select } from "@/components/atoms/select";
import { MetricCard } from "@/components/molecules/metric-card";
import { useUpdateProjectCurrency } from "@/hooks/use-projects";
import { SUPPORTED_CURRENCIES, currencyLabel } from "@/lib/currency";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import type { Project } from "@/lib/project-types";
import { FIELD_LABEL_CLASS, SettingsCard, SettingsHeading } from "./settings-tabs";

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: currencyLabel(c.code) }));

/** The headline figure sits larger than a MetricCard's default value. */
function BudgetFigure({ children }: { children: string }) {
  return <span className="block py-3 text-2xl font-medium">{children}</span>;
}

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
  const compact = (amount: number) => formatCurrency(amount, project.currency, { compact: true });
  const rangeLabel = hasRange
    ? `${compact(project.budgetMin!)}–${compact(project.budgetMax!)}`
    : compact(project.budgetTotal);

  return (
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
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <MetricCard label="Budget range" value={<BudgetFigure>{rangeLabel}</BudgetFigure>} />
        <MetricCard label="Total budget" value={<BudgetFigure>{compact(project.budgetTotal)}</BudgetFigure>} />
      </div>

      <p className="mt-6 text-caption-m! text-gray-600">
        Retention, advance recovery, liquidated damages, VAT and payment terms belong to the
        contract itself -{" "}
        <Link
          to={`/project/${project.id}/finances/contracts-phases`}
          className="font-medium text-primary-600 underline"
        >
          Finance → Contracts &amp; phases
        </Link>
        .
      </p>

      <div className="mt-6">
        <SettingsHeading
          title="Currency"
          description="Used for budgets, finances, materials and estimates on this project. New projects inherit your organisation's default."
        />
        {canManage ? (
          <div className="mt-6 flex flex-wrap items-end gap-2">
            <div className="flex w-full flex-col gap-1.5 sm:w-[calc(50%-12px)]">
              <label htmlFor="project-currency" className={FIELD_LABEL_CLASS}>
                Project currency
              </label>
              <Select
                id="project-currency"
                options={CURRENCY_OPTIONS}
                value={currency}
                className="h-[45px] px-4 text-caption-l!"
                onChange={(next) => next && setCurrency(next)}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              className="h-[46px]"
              loading={updateCurrency.isPending}
              disabled={!currencyDirty}
              onClick={() =>
                updateCurrency.mutate(currency, {
                  onSuccess: () => toast("Project currency updated.", "success"),
                  onError: (e) => toast(errorMessage(e, "Could not update currency."), "error"),
                })
              }
            >
              Save Changes
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-caption-l! text-gray-500">{currencyLabel(project.currency)}</p>
        )}
      </div>
    </SettingsCard>
  );
}

MoneyTab.displayName = "MoneyTab";

export { MoneyTab, type MoneyTabProps };
