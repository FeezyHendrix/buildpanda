import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { useProjectFinances } from "@/hooks/use-finances";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { LedgerType } from "@/lib/project-types";

const LEDGER_TONE: Record<LedgerType, "success" | "info" | "warning"> = {
  Release: "success",
  Deposit: "info",
  Hold: "warning",
};

function SettlementLine({
  label,
  value,
  tone,
  operator,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "muted" | "positive" | "negative" | "brand";
  operator?: "+" | "−" | "=";
  emphasis?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : tone === "brand"
          ? "text-[#004DE7]"
          : "text-gray-900";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        emphasis
          ? "border-t border-gray-900/10 mt-1 pt-4"
          : "border-t border-gray-100 first:border-t-0 first:pt-0",
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        {operator ? (
          <span className="w-4 text-center font-semibold text-gray-400">
            {operator}
          </span>
        ) : (
          <span className="w-4" aria-hidden="true" />
        )}
        <span
          className={cn(
            emphasis ? "text-sm font-semibold text-gray-900" : "text-gray-600",
          )}
        >
          {label}
        </span>
      </div>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "text-lg font-bold" : "text-sm font-medium",
          toneClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function ProjectFinalAccount() {
  const { project } = useProjectContext();
  const { data: finances, isPending } = useProjectFinances(project.id);
  const { data: snapshot } = useReportingSnapshot(project.id);

  const ledgerSorted = useMemo(() => {
    if (!finances?.ledger) return [];
    return [...finances.ledger].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [finances?.ledger]);

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!finances) {
    return (
      <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
        <Breadcrumbs
          items={[
            { label: "Finances", to: `/project/${project.id}/finances` },
            { label: "Final Account" },
          ]}
          className="mb-4"
        />
        <PageHeader
          title="Final Account"
          description="Contract settlement — closing statement showing what has been certified, paid, held and what remains."
        />
        <Card padding="lg" className="mt-8 text-center text-sm text-gray-500">
          No finance data yet for this project.
        </Card>
      </div>
    );
  }

  const currency = finances.currency;
  const retentionHeld = snapshot?.finance?.invoices?.retentionHeld ?? 0;
  const remainingToCertify = Math.max(
    0,
    finances.adjustedContract - finances.certifiedGrossToDate,
  );
  const outstanding = Math.max(
    0,
    finances.adjustedContract -
      finances.amountPaidToDate -
      retentionHeld,
  );
  const percentPaid =
    finances.adjustedContract > 0
      ? Math.min(
          100,
          Math.round(
            (finances.amountPaidToDate / finances.adjustedContract) * 100,
          ),
        )
      : 0;
  const isSettled =
    finances.adjustedContract > 0 &&
    outstanding === 0 &&
    remainingToCertify === 0;

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Final Account" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Final Account"
        description="Contract settlement — closing statement showing what has been certified, paid, held and what remains."
        badges={
          isSettled ? (
            <Badge tone="success" size="md" className="gap-1.5">
              <span aria-hidden="true">✓</span>
              Settled
            </Badge>
          ) : undefined
        }
      />

      <section
        aria-label="Final account summary"
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4"
      >
        <KpiCard
          title="Adjusted contract"
          icon={FinancesIcon.name}
          value={formatCurrency(finances.adjustedContract, currency)}
        />
        <KpiCard
          title="Amount paid"
          icon={FinancesIcon.name}
          value={formatCurrency(finances.amountPaidToDate, currency)}
        />
        <KpiCard
          title="Retention held"
          icon={FinancesIcon.name}
          value={formatCurrency(retentionHeld, currency)}
        />
        <KpiCard
          title="Outstanding"
          icon={FinancesIcon.name}
          value={formatCurrency(outstanding, currency)}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card padding="lg" className="lg:col-span-3">
          <div className="mb-4">
            <h3 className="text-[13px] font-semibold text-black-300">
              Settlement statement
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              How the outstanding balance is computed at closing.
            </p>
          </div>

          <SettlementLine
            label="Original contract sum"
            value={formatCurrency(finances.contractSum, currency)}
          />
          <SettlementLine
            label="Variations"
            operator={finances.variationsTotal >= 0 ? "+" : "−"}
            tone={finances.variationsTotal >= 0 ? "positive" : "negative"}
            value={formatCurrency(
              Math.abs(finances.variationsTotal),
              currency,
            )}
          />
          <SettlementLine
            label="Adjusted contract sum"
            operator="="
            tone="brand"
            value={formatCurrency(finances.adjustedContract, currency)}
            emphasis
          />
          <SettlementLine
            label="Certified to date"
            operator="−"
            value={formatCurrency(finances.certifiedGrossToDate, currency)}
          />
          <SettlementLine
            label="Remaining to certify"
            operator="="
            value={formatCurrency(remainingToCertify, currency)}
          />
          <SettlementLine
            label="Amount paid to date"
            operator="−"
            value={formatCurrency(finances.amountPaidToDate, currency)}
          />
          <SettlementLine
            label="Retention held"
            operator="−"
            value={formatCurrency(retentionHeld, currency)}
          />
          <SettlementLine
            label="Outstanding balance"
            operator="="
            tone="brand"
            value={formatCurrency(outstanding, currency)}
            emphasis
          />

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Paid vs adjusted contract</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {percentPaid}%
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#004DE7] transition-[width] duration-300"
                style={{ width: `${percentPaid}%` }}
              />
            </div>
          </div>
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-[13px] font-semibold text-black-300">
              What happens next
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Bookkeeping-only checklist for closing this contract. BuildPanda
              logs these actions — it does not move money.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs",
                  remainingToCertify === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-400",
                )}
              >
                {remainingToCertify === 0 ? "✓" : "1"}
              </span>
              <div>
                <p className="font-medium text-gray-900">
                  Certify remaining work
                </p>
                <p className="text-xs text-gray-500">
                  Value the last activities and record them against the
                  adjusted contract sum.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs",
                  outstanding === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-400",
                )}
              >
                {outstanding === 0 ? "✓" : "2"}
              </span>
              <div>
                <p className="font-medium text-gray-900">
                  Log the final release
                </p>
                <p className="text-xs text-gray-500">
                  Record the outstanding balance as released once the
                  contractor is paid off-platform.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs",
                  retentionHeld === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-400",
                )}
              >
                {retentionHeld === 0 ? "✓" : "3"}
              </span>
              <div>
                <p className="font-medium text-gray-900">
                  Release retention
                </p>
                <p className="text-xs text-gray-500">
                  Release the retention held after the defects liability
                  period ends.
                </p>
              </div>
            </li>
          </ul>
        </Card>
      </div>

      <Card padding="lg" className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-black-300">
              Payment ledger
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Chronological trail of every release, deposit and hold logged
              against this project.
            </p>
          </div>
        </div>

        {ledgerSorted.length === 0 ? (
          <EmptyState
            title="No payment activity yet"
            description="Deposits, releases and retention holds will appear here as they are recorded."
            className="py-6"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledgerSorted.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-50 last:border-b-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatShortDate(entry.date)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={LEDGER_TONE[entry.type]} size="sm">
                        {entry.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {entry.description}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium tabular-nums",
                        entry.type === "Release"
                          ? "text-emerald-600"
                          : entry.type === "Hold"
                            ? "text-amber-600"
                            : "text-gray-900",
                      )}
                    >
                      {formatCurrency(entry.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
