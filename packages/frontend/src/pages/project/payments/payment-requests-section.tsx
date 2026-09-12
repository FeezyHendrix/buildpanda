import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { useProjectFinances } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreatePaymentClaim,
  useDeletePaymentClaim,
  usePaymentClaims,
  useRecordInvoice,
  useUpdatePaymentClaim,
  type PaymentClaim,
  type PaymentClaimStatus,
} from "@/hooks/use-payment-claims";
import { RecordInvoiceDialog } from "@/components/molecules/record-invoice-dialog";
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
import { TabActions } from "../finances/finance-tabs";

/**
 * Payment requests: contractor progress requests linked to stage payments.
 * Shared section used by the merged Payments workspace and the standalone view.
 */
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

// The certified sum and what came off it, as approved. Shown once a claim is
// approved so the invoice figure is never a surprise at recording time.
function InvoiceLines({ claim, currency }: { claim: PaymentClaim; currency: string }) {
  const rows: { label: string; value: number; sign?: string; strong?: boolean }[] = [
    { label: "Certified", value: claim.amount },
    { label: "Retention", value: claim.retentionAmount ?? 0, sign: "−" },
    { label: "Advance recovery", value: claim.advanceRecoveryAmount ?? 0, sign: "−" },
    { label: "VAT", value: claim.vatAmount ?? 0, sign: "+" },
    { label: claim.invoiceNumber ? `Invoice ${claim.invoiceNumber}` : "Invoice amount", value: claim.invoiceAmount ?? claim.amount, strong: true },
    { label: "WHT deducted by client", value: claim.whtAmount ?? 0, sign: "−" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-gray-50 px-4 py-3 text-xs sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-2">
          <dt className={cn(row.strong ? "font-semibold text-gray-900" : "text-gray-500")}>{row.label}</dt>
          <dd className={cn("tabular-nums", row.strong ? "font-bold text-gray-900" : "text-gray-700")}>
            {row.sign ? `${row.sign} ` : ""}
            {formatCurrency(row.value, currency)}
          </dd>
        </div>
      ))}
      {claim.invoiceRecordedAt ? (
        <p className="col-span-full text-[11px] text-gray-400">
          Invoice recorded {new Date(claim.invoiceRecordedAt).toLocaleDateString()}. Logged, not charged.
        </p>
      ) : null}
    </dl>
  );
}
InvoiceLines.displayName = "InvoiceLines";

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
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const updateClaim = useUpdatePaymentClaim();
  const deleteClaim = useDeletePaymentClaim();
  const recordInvoice = useRecordInvoice();
  const milestoneName = milestones.find((milestone) => milestone.id === claim.milestonePaymentId)?.name;
  const canRecordInvoice = canManage && claim.status === "Approved" && !claim.invoiceRecordedAt;

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
            {canRecordInvoice ? (
              <Button variant="primary" size="sm" onClick={() => setInvoiceOpen(true)}>Record invoice</Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        )}
      </div>

      {claim.invoiceAmount !== null ? <InvoiceLines claim={claim} currency={currency} /> : null}

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
      <RecordInvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        claim={claim}
        currency={currency}
        milestoneName={milestoneName}
        submitting={recordInvoice.isPending}
        error={(recordInvoice.error as Error | undefined)?.message ?? null}
        onSubmit={(invoiceNumber) =>
          recordInvoice.mutate(
            { projectId, claimId: claim.id, invoiceNumber },
            { onSuccess: () => setInvoiceOpen(false) },
          )
        }
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
      <TabActions>
        {canManage ? (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New request
          </Button>
        ) : null}
      </TabActions>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total requested" value={formatCurrency(summary.total, currency)} />
        <KpiCard label="Submitted" value={formatCurrency(summary.submitted, currency)} />
        <KpiCard label="Approved" value={formatCurrency(summary.approved, currency)} />
        <KpiCard label="Paid" value={formatCurrency(summary.paid, currency)} />
      </div>

      <div className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : claims.length === 0 ? (
          <EmptyState
            icon={<FinancesIcon />}
            title="No payment requests yet"
            description="Record contractor payment requests to track approvals and paid amounts."
            action={canManage ? { label: "New request", onClick: () => setCreateOpen(true), icon: <PlusIcon /> } : undefined}
          />
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
