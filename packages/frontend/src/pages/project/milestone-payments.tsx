import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { MilestoneCard } from "@/components/molecules/milestone-card";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDisputeDialog } from "@/components/molecules/raise-dispute-dialog";
import { UpsertMilestoneDialog } from "@/components/molecules/upsert-milestone-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectFinances,
  useDeleteMilestone,
  useRaiseDispute,
  useReleaseMilestone,
  useUpsertMilestone,
} from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { LEDGER_TYPE_TONE } from "@/lib/project-meta";
import type {
  MilestonePayment,
  PaymentLedgerEntry,
  ProjectFinances,
} from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

export default function ProjectMilestonePayments() {
  const { project, access } = useProjectContext();
  const location = useLocation();
  const isUnderSchedules = location.pathname.includes("/schedules");
  const canManage = access?.capabilities?.canManage ?? false;
  const canDispute = canManage || access?.relationship === "client";
  const { data: finances, isPending } = useProjectFinances(project.id);

  const [upsertOpen, setUpsertOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MilestonePayment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MilestonePayment | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(null);
  const upsertMilestone = useUpsertMilestone();
  const deleteMilestone = useDeleteMilestone();
  const releaseMilestone = useReleaseMilestone();
  const raiseDispute = useRaiseDispute();

  if (isPending || !finances) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          isUnderSchedules
            ? { label: "Schedules", to: `/project/${project.id}/schedules` }
            : { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Milestones" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Milestones"
        description="Use milestone cost gates to organize the work items that drive the project schedule."
        // actions={
        //   <Button
        //     variant="primary"
        //     size="md"
        //     onClick={() => {
        //       setEditingTarget(null);
        //       setUpsertOpen(true);
        //     }}
        //   >
        //     <PlusIcon className="size-4" />
        //     New milestone
        //   </Button>
        // }
      />

      <EscrowSummary finances={finances} />

      <Card className="mt-6 rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0">
        <div className="flex items-center justify-between py-3 px-5">
          <div className="flex gap-2 items-center">
            <ReactSVG src={icons.money} />
            <h3 className="text-[13px] font-semibold text-black-300">
              Milestone Payments
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-[12px] h-full m-1 p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {finances.milestones.map((milestone, idx) => (
              <MilestoneCard
                key={`${milestone.id}-${idx}`}
                milestone={milestone}
                currency={finances.currency}
                variant="detailed"
                onEdit={canManage ? () => {
                  setEditingTarget(milestone);
                  setUpsertOpen(true);
                } : undefined}
                onDelete={canManage ? () => setDeleteTarget(milestone) : undefined}
                onReleaseFunds={canManage ? () => setReleaseTarget(milestone) : undefined}
                onRaiseDispute={canDispute ? () => setDisputeTarget(milestone) : undefined}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-6 rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0">
        <div className="flex items-center justify-between py-3 px-5">
          <div className="flex gap-2 items-center">
            <ReactSVG src={icons.bill} />
            <h3 className="text-[13px] font-semibold text-black-300">
              Payment Ledger
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-[12px] h-full m-1 p-6">
          <PaymentLedger
            entries={finances.ledger}
            currency={finances.currency}
          />
        </div>
      </Card>


      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.name ?? "milestone"}?`}
        description="This removes the milestone cost gate. Site activities remain assigned to their project phase."
        confirmLabel="Delete milestone"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMilestone.mutate(
            { projectId: project.id, milestoneId: deleteTarget.id },
            { onSettled: () => setDeleteTarget(null) },
          );
        }}
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

      <UpsertMilestoneDialog
        open={upsertOpen}
        onOpenChange={(next) => {
          setUpsertOpen(next);
          if (!next) setEditingTarget(null);
        }}
        phases={project.timeline}
        initial={editingTarget}
        isSubmitting={upsertMilestone.isPending}
        error={upsertMilestone.error ? (upsertMilestone.error as Error).message : null}
        onSubmit={(values) => {
          upsertMilestone.mutate(
            {
              projectId: project.id,
              milestoneId: editingTarget?.id,
              ...values,
            },
            {
              onSuccess: () => {
                setUpsertOpen(false);
                setEditingTarget(null);
              },
            },
          );
        }}
      />
    </div>
  );
}

function EscrowSummary({ finances }: { finances: ProjectFinances }) {
  return (
    <Card padding="lg" className="mt-8 border-primary border-[4px]">
      <div className="flex items-end justify-between">
        <div className='flex flex-col gap-2'>
          <p className="text-[13px] font-semibold text-black-300">Escrow Summary</p>
          <p className="text-[25px] font-bold text-black-500">{formatCurrency(finances.lockedInEscrow, finances.currency)}</p>
          <Badge size="md" className='bg-success-50 text-success-700'>
            <ReactSVG src={icons.verified} className='[&svg]:[&>path]:fill-success-500' />
            Total Verified Funds in Trust
          </Badge>
        </div>
        <div className='flex gap-6'>
          <div>
            <p className="text-[13px] font-semibold text-black-300">Next Release</p>
            <p className="text-black-500">{formatCurrency(finances.lockedInEscrow, finances.currency)}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-black-300">In Transit</p>
            <p className="text-black-500">{formatCurrency(finances.lockedInEscrow, finances.currency)}</p>
          </div>
        </div>
        {/* <SummaryStat
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
        /> */}
      </div>
    </Card>
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
    <section>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#EDEDED] bg-[#F6F6F6] text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-3 font-semibold text-black-300 text-[11px] capitalize">Date</th>
              <th className="px-6 py-3 font-semibold text-black-300 text-[11px] capitalize">Milestone</th>
              <th className="px-6 py-3 font-semibold text-black-300 text-[11px] capitalize">Amount</th>
              <th className="px-6 py-3 font-semibold text-black-300 text-[11px] capitalize">Status</th>
              <th className="px-6 py-3 font-semibold text-black-300 text-[11px] capitalize">Action</th>
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
      <Card padding="none" className="overflow-hidden border-none">

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
      <td className="px-6 py-3 text-[13px] tabular-nums text-[#131B2E]">{entry.date}</td>
      <td className="px-6 py-3 text-[13px] text-[#131B2E]">{entry.description}</td>
      <td className="px-6 py-3 text-[13px] tabular-nums text-[#131B2E]">
        {formatCurrency(entry.amount, currency)}
      </td>
      <td className="px-6 py-3 text-[13px]">
        <Badge tone={LEDGER_TYPE_TONE[entry.type]} size="md">
          {entry.type}
        </Badge>
      </td>
      <td className="px-6 py-3 text-[13px]">
        <button
          className="h-[32px] cursor-pointer text-primary text-[13px] font-semibold"
        >
          View Receipt
        </button>
      </td>
    </tr>
  );
}
