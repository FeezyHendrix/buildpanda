import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { useProjectFinances } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreatePaymentClaim,
  useDeletePaymentClaim,
  usePaymentClaims,
  useUpdatePaymentClaim,
  type PaymentClaim,
  type PaymentClaimStatus,
} from "@/hooks/use-payment-claims";
import { formatCurrency } from "@/lib/formatters";
import type { MilestonePayment } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import {
  STATUS_SHAPE,
  STATUS_TONE,
  toInput,
  toValues,
  type RequestValues,
} from "./payment-request-model";
import { UpsertRequestDialog } from "./upsert-request-dialog";

/**
 * Payment requests: contractor progress requests linked to stage payments.
 * Shared section used by the merged Payments workspace and the standalone view.
 */
function SummaryTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={cn("mt-1 text-base font-bold tabular-nums", accent ? "text-[#004DE7]" : "text-gray-900")}>{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: PaymentClaimStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} size="md" className="gap-1.5">
      <span aria-hidden="true">{STATUS_SHAPE[status]}</span>
      {status}
    </Badge>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent ? "text-[#004DE7]" : "text-gray-900")}>{value}</span>
    </div>
  );
}

function RequestCard({
  projectId,
  claim,
  currency,
  milestones,
  canManage,
}: {
  projectId: string;
  claim: PaymentClaim;
  currency: string;
  milestones: MilestonePayment[];
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateClaim = useUpdatePaymentClaim();
  const deleteClaim = useDeletePaymentClaim();
  const milestoneName = milestones.find((milestone) => milestone.id === claim.milestonePaymentId)?.name;

  function handleEdit(values: RequestValues): void {
    updateClaim.mutate(
      { projectId, claimId: claim.id, ...toInput(values) },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-gray-900">{claim.claimNumber}</p>
            <StatusBadge status={claim.status} />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {claim.periodStart || claim.periodEnd ? `${claim.periodStart ?? "Open"} – ${claim.periodEnd ?? "Open"}` : "No period"}
            {claim.milestonePaymentId ? ` · Stage ${milestoneName ?? claim.milestonePaymentId}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Amount" value={formatCurrency(claim.amount, currency)} accent />
        <Metric label="Submitted" value={claim.submittedAt ?? "—"} />
        <Metric label="Approved" value={claim.approvedAt ?? "—"} />
        <Metric label="Created" value={new Date(claim.createdAt).toLocaleDateString()} />
      </div>

      {claim.notes && <p className="text-sm text-gray-600 text-pretty">{claim.notes}</p>}

      <UpsertRequestDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={toValues(claim)}
        onSubmit={handleEdit}
        isSubmitting={updateClaim.isPending}
        error={(updateClaim.error as Error | undefined)?.message ?? null}
        currency={currency}
        milestones={milestones}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete payment request?"
        description={`This will permanently remove ${claim.claimNumber}.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteClaim.isPending}
        onConfirm={() => {
          deleteClaim.mutate(
            { projectId, claimId: claim.id },
            { onSuccess: () => setDeleteOpen(false) },
          );
        }}
      />
    </Card>
  );
}

export function PaymentRequestsSection() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const currency = project.currency;
  const { data: claims = [], isPending } = usePaymentClaims(project.id);
  const { data: finances } = useProjectFinances(project.id);
  const [createOpen, setCreateOpen] = useState(false);
  const createClaim = useCreatePaymentClaim();

  const summary = useMemo(() => {
    return claims.reduce(
      (acc, claim) => {
        acc.total += claim.amount;
        if (claim.status === "Submitted") acc.submitted += claim.amount;
        if (claim.status === "Approved") acc.approved += claim.amount;
        if (claim.status === "Paid") acc.paid += claim.amount;
        return acc;
      },
      { total: 0, submitted: 0, approved: 0, paid: 0 },
    );
  }, [claims]);

  function handleCreate(values: RequestValues): void {
    createClaim.mutate(
      { projectId: project.id, ...toInput(values) },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <section aria-label="Payment requests">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Payment requests</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Contractor requests for payment, and their approval status.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New request
          </Button>
        )}
      </div>

      <UpsertRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createClaim.isPending}
        error={(createClaim.error as Error | undefined)?.message ?? null}
        currency={currency}
        milestones={finances?.milestones ?? []}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Total requested" value={formatCurrency(summary.total, currency)} />
        <SummaryTile label="Submitted" value={formatCurrency(summary.submitted, currency)} />
        <SummaryTile label="Approved" value={formatCurrency(summary.approved, currency)} />
        <SummaryTile label="Paid" value={formatCurrency(summary.paid, currency)} accent />
      </div>

      <div className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : claims.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<FinancesIcon className="size-6" />}
              title="No payment requests yet"
              description="Record contractor payment requests to track approvals and paid amounts."
              action={canManage ? (
                <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                  <PlusIcon className="size-4" />
                  New request
                </Button>
              ) : undefined}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {claims.map((claim) => (
              <RequestCard
                key={claim.id}
                projectId={project.id}
                claim={claim}
                currency={currency}
                milestones={finances?.milestones ?? []}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

PaymentRequestsSection.displayName = "PaymentRequestsSection";
