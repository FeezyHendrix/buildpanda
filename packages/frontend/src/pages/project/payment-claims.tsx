import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { ComboSelect } from "@/components/molecules/combo-select";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { PageHeader } from "@/components/molecules/page-header";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { useProjectFinances } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreatePaymentClaim,
  useDeletePaymentClaim,
  usePaymentClaims,
  useUpdatePaymentClaim,
  type PaymentClaim,
  type PaymentClaimInput,
  type PaymentClaimStatus,
} from "@/hooks/use-payment-claims";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import type { MilestonePayment } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { cn } from "@/lib/utils";

interface PaymentClaimValues {
  milestonePaymentId: string;
  claimNumber: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  status: PaymentClaimStatus;
  submittedAt: string;
  approvedAt: string;
  notes: string;
}

const STATUSES: PaymentClaimStatus[] = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
  "Paid",
];

const STATUS_TONE: Record<PaymentClaimStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Draft: "neutral",
  Submitted: "info",
  Approved: "success",
  Rejected: "danger",
  Paid: "success",
};

const STATUS_SHAPE: Record<PaymentClaimStatus, string> = {
  Draft: "○",
  Submitted: "→",
  Approved: "✓",
  Rejected: "×",
  Paid: "●",
};

const EMPTY: PaymentClaimValues = {
  milestonePaymentId: "",
  claimNumber: "",
  periodStart: "",
  periodEnd: "",
  amount: "",
  status: "Draft",
  submittedAt: "",
  approvedAt: "",
  notes: "",
};

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

function toInput(values: PaymentClaimValues): PaymentClaimInput {
  return {
    milestonePaymentId: values.milestonePaymentId || null,
    claimNumber: values.claimNumber,
    periodStart: values.periodStart || undefined,
    periodEnd: values.periodEnd || undefined,
    amount: Number(values.amount),
    status: values.status,
    submittedAt: values.submittedAt || undefined,
    approvedAt: values.approvedAt || undefined,
    notes: values.notes || undefined,
  };
}

function toValues(claim: PaymentClaim): PaymentClaimValues {
  return {
    milestonePaymentId: claim.milestonePaymentId ?? "",
    claimNumber: claim.claimNumber,
    periodStart: claim.periodStart ?? "",
    periodEnd: claim.periodEnd ?? "",
    amount: String(claim.amount),
    status: claim.status,
    submittedAt: claim.submittedAt ?? "",
    approvedAt: claim.approvedAt ?? "",
    notes: claim.notes ?? "",
  };
}

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

function UpsertPaymentClaimDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency,
  milestones,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: PaymentClaimValues;
  onSubmit: (values: PaymentClaimValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency: string;
  milestones: MilestonePayment[];
}) {
  const [values, setValues] = useState<PaymentClaimValues>(EMPTY);
  const symbol = currencySymbol(currency);
  const milestoneItems = useMemo(
    () => milestones.map((milestone) => ({ id: milestone.id, label: milestone.name })),
    [milestones],
  );

  useEffect(() => {
    if (open) setValues(initial ?? EMPTY);
  }, [open, initial]);

  function update<K extends keyof PaymentClaimValues>(key: K, value: PaymentClaimValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const amountNumber = Number(values.amount);
  const isValid =
    values.claimNumber.trim().length > 0 &&
    values.amount.trim().length > 0 &&
    Number.isFinite(amountNumber) &&
    amountNumber >= 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      ...values,
      claimNumber: values.claimNumber.trim(),
      amount: String(amountNumber),
      notes: values.notes.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit payment claim" : "New payment claim"}
      description={
        mode === "edit"
          ? "Update this contractor progress claim and approval status."
          : "Record a contractor progress claim or drawdown request for this project."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Add claim"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claim-number">Claim number</Label>
        <input
          id="claim-number"
          value={values.claimNumber}
          onChange={(e) => update("claimNumber", e.target.value)}
          placeholder="e.g. PC-0042"
          maxLength={100}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claim-milestone">Milestone payment</Label>
        <ComboSelect
          items={milestoneItems}
          value={values.milestonePaymentId || null}
          onChange={(value) => update("milestonePaymentId", value ?? "")}
          placeholder="No milestone linked"
          searchPlaceholder="Search milestones…"
          emptyText="No milestones available"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-amount">Amount</Label>
          <MoneyInput
            id="claim-amount"
            value={values.amount}
            onChange={(v) => update("amount", v)}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-status">Status</Label>
          <select
            id="claim-status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as PaymentClaimStatus)}
            className={inputClass}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-period-start">Period start</Label>
          <input id="claim-period-start" type="date" value={values.periodStart} onChange={(e) => update("periodStart", e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-period-end">Period end</Label>
          <input id="claim-period-end" type="date" value={values.periodEnd} onChange={(e) => update("periodEnd", e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-submitted-at">Submitted at</Label>
          <input id="claim-submitted-at" type="date" value={values.submittedAt} onChange={(e) => update("submittedAt", e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-approved-at">Approved at</Label>
          <input id="claim-approved-at" type="date" value={values.approvedAt} onChange={(e) => update("approvedAt", e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claim-notes">Notes</Label>
        <textarea
          id="claim-notes"
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Work completed, supporting evidence, or approval context…"
          maxLength={2000}
          rows={4}
          className={cn(inputClass, "h-auto py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

function PaymentClaimCard({
  projectId,
  claim,
  currency,
  milestones,
}: {
  projectId: string;
  claim: PaymentClaim;
  currency: string;
  milestones: MilestonePayment[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateClaim = useUpdatePaymentClaim();
  const deleteClaim = useDeletePaymentClaim();
  const milestoneName = milestones.find((milestone) => milestone.id === claim.milestonePaymentId)?.name;

  function handleEdit(values: PaymentClaimValues): void {
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
            {claim.periodStart || claim.periodEnd ? `${claim.periodStart ?? "Open"} – ${claim.periodEnd ?? "Open"}` : "No claim period"}
            {claim.milestonePaymentId ? ` · Milestone ${milestoneName ?? claim.milestonePaymentId}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Amount" value={formatCurrency(claim.amount, currency)} accent />
        <Metric label="Submitted" value={claim.submittedAt ?? "—"} />
        <Metric label="Approved" value={claim.approvedAt ?? "—"} />
        <Metric label="Created" value={new Date(claim.createdAt).toLocaleDateString()} />
      </div>

      {claim.notes && <p className="text-sm text-gray-600 text-pretty">{claim.notes}</p>}

      <UpsertPaymentClaimDialog
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
        title="Delete payment claim?"
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

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent ? "text-[#004DE7]" : "text-gray-900")}>{value}</span>
    </div>
  );
}

export default function ProjectPaymentClaims() {
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

  function handleCreate(values: PaymentClaimValues): void {
    createClaim.mutate(
      { projectId: project.id, ...toInput(values) },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs items={[{ label: "Finances", to: `/project/${project.id}/finances` }, { label: "Payment claims" }]} className="mb-4" />
      <PageHeader
        title="Payment Claims"
        description="Track contractor progress claims, drawdowns, approvals, and paid amounts across the project."
        actions={canManage ? (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New claim
          </Button>
        ) : undefined}
      />

      <UpsertPaymentClaimDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createClaim.isPending}
        error={(createClaim.error as Error | undefined)?.message ?? null}
        currency={currency}
        milestones={finances?.milestones ?? []}
      />

      <section aria-label="Payment claims summary" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Total Claimed" value={formatCurrency(summary.total, currency)} />
        <SummaryTile label="Submitted" value={formatCurrency(summary.submitted, currency)} />
        <SummaryTile label="Approved" value={formatCurrency(summary.approved, currency)} />
        <SummaryTile label="Paid" value={formatCurrency(summary.paid, currency)} accent />
      </section>

      <section className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : claims.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<FinancesIcon className="size-6" />}
              title="No payment claims yet"
              description="Record contractor progress claims or drawdowns to track approvals and paid amounts."
              action={canManage ? (
                <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                  <PlusIcon className="size-4" />
                  New claim
                </Button>
              ) : undefined}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {claims.map((claim) => (
              <PaymentClaimCard
                key={claim.id}
                projectId={project.id}
                claim={claim}
                currency={currency}
                milestones={finances?.milestones ?? []}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
