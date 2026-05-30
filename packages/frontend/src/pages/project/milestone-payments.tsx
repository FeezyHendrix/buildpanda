import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { MilestoneCard } from "@/components/molecules/milestone-card";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDisputeDialog } from "@/components/molecules/raise-dispute-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectFinances,
  useRaiseDispute,
  useReleaseMilestone,
} from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { LEDGER_TYPE_TONE } from "@/lib/project-meta";
import type {
  MilestonePayment,
  PaymentLedgerEntry,
  ProjectFinances,
} from "@/lib/project-mock-data";

export default function ProjectMilestonePayments() {
  const { project } = useProjectContext();
  const { data: finances, isPending } = useProjectFinances(project.id);

  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(null);
  const releaseMilestone = useReleaseMilestone();
  const raiseDispute = useRaiseDispute();

  if (isPending || !finances) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Milestone Payments" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Milestone Payments"
        description="Manage fund releases based on verified project completion."
      />

      <EscrowSummary finances={finances} />

      <section className="mt-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Milestone Payments
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {finances.milestones.map((milestone, idx) => (
            <MilestoneCard
              key={`${milestone.id}-${idx}`}
              milestone={milestone}
              currency={finances.currency}
              variant="detailed"
              onReleaseFunds={() => setReleaseTarget(milestone)}
              onRaiseDispute={() => setDisputeTarget(milestone)}
            />
          ))}
        </div>
      </section>

      <PaymentLedger
        entries={finances.ledger}
        currency={finances.currency}
      />

      <ConfirmDialog
        open={releaseTarget !== null}
        onOpenChange={(next) => {
          if (!next) setReleaseTarget(null);
        }}
        title={`Release ${releaseTarget?.name ?? "milestone"} funds?`}
        description={`${
          releaseTarget ? formatCurrency(releaseTarget.amount, finances.currency) : ""
        } will be released from escrow.`}
        confirmLabel="Release funds"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!releaseTarget) return;
          releaseMilestone.mutate(
            { projectId: project.id, milestoneId: releaseTarget.id },
            { onSettled: () => setReleaseTarget(null) },
          );
        }}
      />

      <RaiseDisputeDialog
        open={disputeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDisputeTarget(null);
        }}
        milestoneName={disputeTarget?.name ?? ""}
        isSubmitting={raiseDispute.isPending}
        error={raiseDispute.error ? (raiseDispute.error as Error).message : null}
        onSubmit={({ reason }) => {
          if (!disputeTarget) return;
          raiseDispute.mutate(
            { projectId: project.id, milestoneId: disputeTarget.id, reason },
            { onSuccess: () => setDisputeTarget(null) },
          );
        }}
      />
    </div>
  );
}

function EscrowSummary({ finances }: { finances: ProjectFinances }) {
  return (
    <Card padding="lg" className="mt-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <SummaryStat
          label="Total Budget"
          value={formatCurrency(finances.totalBudget, finances.currency)}
        />
        <SummaryStat
          label="Locked In Escrow"
          value={formatCurrency(finances.lockedInEscrow, finances.currency)}
          accent
        />
        <SummaryStat
          label="Funds Released"
          value={formatCurrency(finances.fundsReleased, finances.currency)}
        />
        <SummaryStat
          label="Remaining"
          value={formatCurrency(finances.remainingBalance, finances.currency)}
        />
      </div>
    </Card>
  );
}

function SummaryStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          accent ? "text-[#004DE7]" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PaymentLedger({
  entries,
  currency,
}: {
  entries: PaymentLedgerEntry[];
  currency: ProjectFinances["currency"];
}) {
  return (
    <section className="mt-6">
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-[#EDEDED] bg-[#FAFAFA] px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Payment Ledger
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Complete history of escrow movements.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#EDEDED] text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <LedgerRow
                key={entry.id}
                entry={entry}
                currency={currency}
                isLast={idx === entries.length - 1}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

function LedgerRow({
  entry,
  currency,
  isLast,
}: {
  entry: PaymentLedgerEntry;
  currency: ProjectFinances["currency"];
  isLast: boolean;
}) {
  return (
    <tr className={isLast ? undefined : "border-b border-[#F0F0F0]"}>
      <td className="px-6 py-3 tabular-nums text-gray-700">{entry.date}</td>
      <td className="px-6 py-3 text-gray-900">{entry.description}</td>
      <td className="px-6 py-3">
        <Badge tone={LEDGER_TYPE_TONE[entry.type]} size="md">
          {entry.type}
        </Badge>
      </td>
      <td className="px-6 py-3 text-right font-semibold tabular-nums text-gray-900">
        {formatCurrency(entry.amount, currency)}
      </td>
    </tr>
  );
}
