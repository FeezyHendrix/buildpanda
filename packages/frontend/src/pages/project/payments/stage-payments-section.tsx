import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { MilestoneCard } from "@/components/molecules/milestone-card";
import { UpsertMilestoneDialog } from "@/components/molecules/upsert-milestone-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectFinances,
  useDeleteMilestone,
  useUpsertMilestone,
} from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { LEDGER_TYPE_TONE } from "@/lib/project-meta";
import type {
  MilestonePayment,
  PaymentLedgerEntry,
  ProjectFinances,
} from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { TabActions } from "../finances/finance-tabs";
import { StagePaymentDialogs } from "./stage-payment-dialogs";

/**
 * Stage payments: the milestone cost gates plus the payment record.
 * Wording is "record payment", never "release funds" — BuildPanda logs money
 * movements made off-platform, it does not move money.
 */
export function StagePaymentsSection() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const canDispute = canManage || canResourceAction(access, "finances", "dispute");
  const { data: finances } = useProjectFinances(project.id);

  const [upsertOpen, setUpsertOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MilestonePayment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MilestonePayment | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(null);
  const upsertMilestone = useUpsertMilestone();
  const deleteMilestone = useDeleteMilestone();

  if (!finances) return null;

  const newButton = canManage ? (
    <Button
      variant="primary"
      size="md"
      onClick={() => {
        setEditingTarget(null);
        setUpsertOpen(true);
      }}
    >
      <PlusIcon className="size-4" />
      New stage payment
    </Button>
  ) : undefined;

  return (
    <section aria-label="Stage payments">
      <TabActions>{newButton}</TabActions>

      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Stages</h2>
        {finances.milestones.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No stage payments yet"
            description="Add a stage payment to gate contractor payments on completed work."
          />
        ) : (
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
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Payment record</h2>
        <Card padding="none" className="overflow-hidden">
          <PaymentRecord entries={finances.ledger} currency={finances.currency} />
        </Card>
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.name ?? "stage payment"}?`}
        description="This removes the milestone cost gate. Site activities remain assigned to their project phase."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMilestone.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMilestone.mutate(
            { projectId: project.id, milestoneId: deleteTarget.id },
            { onSettled: () => setDeleteTarget(null) },
          );
        }}
      />

      <StagePaymentDialogs
        projectId={project.id}
        currency={finances.currency}
        releaseTarget={releaseTarget}
        disputeTarget={disputeTarget}
        onReleaseClose={() => setReleaseTarget(null)}
        onDisputeClose={() => setDisputeTarget(null)}
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
            { projectId: project.id, milestoneId: editingTarget?.id, ...values },
            {
              onSuccess: () => {
                setUpsertOpen(false);
                setEditingTarget(null);
              },
            },
          );
        }}
      />
    </section>
  );
}

StagePaymentsSection.displayName = "StagePaymentsSection";

function PaymentRecord({
  entries,
  currency,
}: {
  entries: PaymentLedgerEntry[];
  currency: ProjectFinances["currency"];
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="No payments recorded yet"
        description="Deposits and releases logged against a stage will appear here."
      />
    );
  }
  return (
    <Table className="min-w-[480px]">
      <TableHead>
        <tr>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Stage</TableHeaderCell>
          <TableHeaderCell>Amount</TableHeaderCell>
          <TableHeaderCell>Type</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <LedgerRow key={entry.id} entry={entry} currency={currency} />
        ))}
      </TableBody>
    </Table>
  );
}

function LedgerRow({
  entry,
  currency,
}: {
  entry: PaymentLedgerEntry;
  currency: ProjectFinances["currency"];
}) {
  return (
    <TableRow>
      <TableCell className="tabular-nums">{entry.date}</TableCell>
      <TableCell>{entry.description}</TableCell>
      <TableCell className="tabular-nums">{formatCurrency(entry.amount, currency)}</TableCell>
      <TableCell>
        <Badge tone={LEDGER_TYPE_TONE[entry.type]} size="md">
          {entry.type}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
