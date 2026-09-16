import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, MoreVertical, Plus } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { MoneyInput } from "@/components/atoms/money-input";
import { Select } from "@/components/atoms/select";
import { Spinner } from "@/components/atoms/spinner";
import { TextArea } from "@/components/atoms/text-area";
import { TextInput } from "@/components/atoms/text-input";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { MetricCard } from "@/components/molecules/metric-card";
import { useProjectContext } from "@/layouts/project-layout";
import { useSetPageTitle } from "@/contexts/page-title-context";
import {
  useCreateEquipmentRequest,
  useDeleteEquipmentRequest,
  useEquipmentRequests,
  useUpdateEquipmentRequest,
  type EquipmentRequestInput,
} from "@/hooks/use-materials-equipment";
import {
  currencySymbol,
  formatCurrency,
  formatShortDate,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  EquipmentBucket,
  EquipmentRequest,
  EquipmentRequestStatus,
  RequestPriority,
} from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";

const BUCKETS: Array<{
  bucket: EquipmentBucket;
  label: string;
  helper: string;
}> = [
  { bucket: "requests", label: "Requests", helper: "New rental needs" },
  { bucket: "approvals", label: "Approvals", helper: "Awaiting go-ahead" },
  { bucket: "schedule", label: "Schedule", helper: "Approved to book" },
  { bucket: "on-hire", label: "On hire", helper: "Mobilized to site" },
  { bucket: "returns", label: "Returns", helper: "Closed or cancelled" },
];

const DEFAULT_BUCKET_META = BUCKETS[0]!;

const STATUS_META: Record<
  EquipmentRequestStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  Draft: { label: "Draft", tone: "neutral" },
  Requested: { label: "Requested", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Scheduled: { label: "Scheduled", tone: "warning" },
  OnHire: { label: "On hire", tone: "warning" },
  Returned: { label: "Returned", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

const PRIORITY_TONE: Record<RequestPriority, "danger" | "warning" | "neutral"> = {
  Critical: "danger",
  High: "warning",
  Normal: "neutral",
  Low: "neutral",
};

const PRIORITY_OPTIONS = (["Low", "Normal", "High", "Critical"] as RequestPriority[]).map(
  (priority) => ({ value: priority, label: priority }),
);

const CURRENCIES = ["NGN", "USD"] as const;

const PAGE_SIZE = 10;

function pageNumbers(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const window = [page - 1, page, page + 1].filter((n) => n > 1 && n < totalPages);
  const pages = new Set([1, totalPages, ...window]);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("…");
    out.push(n);
  });
  return out;
}

function nextStatus(status: EquipmentRequestStatus): EquipmentRequestStatus | null {
  switch (status) {
    case "Draft":
      return "Requested";
    case "Requested":
      return "Approved";
    case "Approved":
      return "Scheduled";
    case "Scheduled":
      return "OnHire";
    case "OnHire":
      return "Returned";
    case "Returned":
    case "Cancelled":
      return null;
  }
}

function defaultFrom(): string {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function defaultUntil(): string {
  return new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function ProjectEquipmentRequests() {
  useSetPageTitle(
    "Equipments Request",
    "Manage equipment from field request through approval, booking, site use, and return so machinery never sits outside the build plan.",
  );

  const { project, access } = useProjectContext();
  const navigate = useNavigate();
  const canRequest = canResourceAction(access, "materials", "request");
  const canApprove = canResourceAction(access, "materials", "approve");
  const params = useParams<{ bucket?: EquipmentBucket }>();
  const activeBucket: EquipmentBucket = BUCKETS.some((item) => item.bucket === params.bucket)
    ? (params.bucket as EquipmentBucket)
    : "requests";
  const activeMeta =
    BUCKETS.find((item) => item.bucket === activeBucket) ?? DEFAULT_BUCKET_META;
  const { data: requests = [], isLoading } = useEquipmentRequests(
    project.id,
    activeBucket,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentRequest | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const createRequest = useCreateEquipmentRequest();
  const updateRequest = useUpdateEquipmentRequest();
  const deleteRequest = useDeleteEquipmentRequest();

  useEffect(() => {
    setPage(1);
  }, [activeBucket, search]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((request) =>
      [request.title, request.equipmentName, request.supplier ?? ""].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [requests, search]);

  function upsert(values: EquipmentRequestInput): void {
    if (editTarget) {
      updateRequest.mutate(
        { projectId: project.id, requestId: editTarget.id, ...values },
        { onSuccess: () => setEditTarget(null) },
      );
      return;
    }
    createRequest.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  const bookedCost = requests.reduce((sum, request) => sum + request.estimatedCost, 0);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = visible.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, visible.length);

  return (
    <div className="mx-auto w-full max-w-[738px] px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          options={BUCKETS.map((item) => ({ value: item.bucket, label: item.label }))}
          value={activeBucket}
          onChange={(v) =>
            v && navigate(`/project/${project.id}/equipment-requests/${v}`)
          }
          className="shrink-0 sm:w-[160px]"
        />
        {canRequest && (
          <Button variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Equipments Request
          </Button>
        )}
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricCard
          label="Visible requests"
          value={requests.length}
          helperText={activeMeta.helper}
        />
        <MetricCard
          label="Booked cost"
          value={formatCurrency(bookedCost, project.currency, { compact: true })}
          helperText="Estimated hire spend"
        />
      </section>

      <div className="mt-8 min-w-0">
        <h2 className="text-[18px] font-bold text-[#1E1E1E]">Requests</h2>

        <div className="relative mt-3 w-full sm:max-w-[320px]">
          <ReactSVG
            src={icons2.search}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 shrink-0 [&_svg]:size-[18px]"
          />
          <TextInput
            type="search"
            placeholder="Search Orders and Requests"
            value={search}
            onChange={setSearch}
            aria-label="Search requests"
            className="h-9 w-full indent-8"
          />
        </div>

        <div className="mt-3">
          {isLoading ? (
            <div className="flex justify-center border border-[#EBEBEB] bg-white py-16">
              <Spinner size="md" />
            </div>
          ) : visible.length === 0 ? (
            <div className="border border-[#EBEBEB] bg-white">
              <EmptyState
                title="No equipment requests here"
                description="Create a rental request or move existing equipment through the lifecycle."
                action={
                  canRequest ? (
                    <Button variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
                      <Plus className="size-4" />
                      Create request
                    </Button>
                  ) : undefined
                }
                className="py-10"
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {paged.map((request) => (
                  <EquipmentRow
                    key={request.id}
                    request={request}
                    canRequest={canRequest}
                    canApprove={canApprove}
                    onEdit={() => setEditTarget(request)}
                    onDelete={() => setDeleteTarget(request)}
                    onAdvance={(status) =>
                      updateRequest.mutate({
                        projectId: project.id,
                        requestId: request.id,
                        status,
                      })
                    }
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#767676]">
                  Showing {showingFrom} to {showingTo} of {visible.length} Requests
                </p>
                {totalPages > 1 && (
                  <nav aria-label="Requests pages" className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={safePage === 1}
                      onClick={() => setPage(safePage - 1)}
                      className="flex size-7 items-center justify-center rounded-full text-[#1E1E1E] outline-none transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    {pageNumbers(safePage, totalPages).map((n, i) =>
                      n === "…" ? (
                        <span key={`gap-${i}`} className="px-1 text-xs text-[#9CA3AF]">
                          …
                        </span>
                      ) : (
                        <button
                          key={n}
                          type="button"
                          aria-label={`Page ${n}`}
                          aria-current={n === safePage ? "page" : undefined}
                          onClick={() => setPage(n)}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full text-[13px] font-medium outline-none transition-colors",
                            n === safePage
                              ? "bg-[#1E1E1E] text-white"
                              : "text-[#1E1E1E] hover:bg-[#F5F5F5]",
                          )}
                        >
                          {n}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={safePage === totalPages}
                      onClick={() => setPage(safePage + 1)}
                      className="flex size-7 items-center justify-center rounded-full text-[#1E1E1E] outline-none transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </nav>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <EquipmentRequestDialog
        open={createOpen || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        initial={editTarget}
        onSubmit={upsert}
        isSubmitting={createRequest.isPending || updateRequest.isPending}
        error={
          ((createRequest.error ?? updateRequest.error) as Error | null)?.message ?? null
        }
        currency={project.currency}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete equipment request?"
        description="This removes the rental request from the equipment lifecycle board."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteRequest.mutate(
              { projectId: project.id, requestId: deleteTarget.id },
              { onSuccess: () => setDeleteTarget(null) },
            );
          }
        }}
      />
    </div>
  );
}

function EquipmentRow({
  request,
  onEdit,
  onDelete,
  onAdvance,
  canRequest,
  canApprove,
}: {
  request: EquipmentRequest;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: (status: EquipmentRequestStatus) => void;
  canRequest: boolean;
  canApprove: boolean;
}) {
  const next = nextStatus(request.status);
  // Approval-tier transitions mirror the backend guard.
  const APPROVAL = ["Approved", "Scheduled", "OnHire", "Returned"];
  const canAdvance =
    next !== null && (APPROVAL.includes(next) ? canApprove : canRequest);
  return (
    <article className="border border-[#EBEBEB] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          <span className="font-medium text-[#004DE7]">
            {formatShortDate(request.neededFrom) || "—"} →{" "}
            {formatShortDate(request.neededUntil) || "—"}
          </span>
          <span className="text-[#D1D5DB]">•</span>
          <span className="text-[#767676]">Phase: {request.phaseName ?? "Unlinked"}</span>
          <span className="text-[#D1D5DB]">•</span>
          <span className="text-[#767676]">
            Activity: {request.activityName ?? "Unlinked"}
          </span>
          <span className="text-[#D1D5DB]">•</span>
          <span className="text-[#767676]">Doc: {request.documentName ?? "No receipt/spec"}</span>
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Request actions"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#9CA3AF] outline-none transition-colors hover:bg-[#F5F5F5] hover:text-[#1E1E1E]"
              >
                <MoreVertical className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-[200px]">
            {canRequest && (
              <DropdownMenuItem onSelect={onEdit}>
                <ReactSVG src={icons2.edit} className="size-4 shrink-0" />
                Edit
              </DropdownMenuItem>
            )}
            {canAdvance && next && (
              <DropdownMenuItem onSelect={() => onAdvance(next)}>
                Move to {STATUS_META[next].label}
              </DropdownMenuItem>
            )}
            {canApprove && (
              <DropdownMenuItem tone="danger" onSelect={onDelete}>
                <ReactSVG src={icons2.delete} className="size-4 shrink-0" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1E1E1E]">
            <span className="truncate">
              {request.quantity} × {request.equipmentName}
            </span>
            <Badge tone={PRIORITY_TONE[request.priority]} size="sm">
              {request.priority}
            </Badge>
          </p>
          <p className="mt-1 truncate text-xs text-[#767676]">{request.title}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p className="whitespace-nowrap text-sm font-bold tabular-nums text-[#1E1E1E]">
            {formatCurrency(request.estimatedCost, request.currency)}
          </p>
          <Badge tone={STATUS_META[request.status].tone} size="sm">
            {STATUS_META[request.status].label}
          </Badge>
        </div>
      </div>
    </article>
  );
}

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EquipmentRequest | null;
  onSubmit: (values: EquipmentRequestInput) => void;
  isSubmitting: boolean;
  error: string | null;
  currency?: string;
}

function EquipmentRequestDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting,
  error,
  currency = "NGN",
}: EquipmentDialogProps) {
  const [title, setTitle] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Plant");
  const [quantity, setQuantity] = useState("1");
  const [supplier, setSupplier] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededFrom, setNeededFrom] = useState(defaultFrom());
  const [neededUntil, setNeededUntil] = useState(defaultUntil());
  const [requestCurrency, setRequestCurrency] = useState(currency);
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [operatorRequired, setOperatorRequired] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setEquipmentName(initial?.equipmentName ?? "");
    setEquipmentType(initial?.equipmentType ?? "Plant");
    setQuantity(String(initial?.quantity ?? 1));
    setSupplier(initial?.supplier ?? "");
    setPriority(initial?.priority ?? "Normal");
    setNeededFrom(initial?.neededFrom.slice(0, 10) ?? defaultFrom());
    setNeededUntil(initial?.neededUntil.slice(0, 10) ?? defaultUntil());
    setRequestCurrency(initial?.currency ?? currency);
    setEstimatedCost(String(initial?.estimatedCost ?? 0));
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setOperatorRequired(initial?.operatorRequired ?? false);
    setNotes(initial?.notes ?? "");
  }, [initial, open, currency]);

  const valid =
    title.trim() &&
    equipmentName.trim() &&
    equipmentType.trim() &&
    Number(quantity) > 0 &&
    neededFrom &&
    neededUntil;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit Equipments Request" : "New Equipments Request"}
      description="Tie equipment rentals to schedule dates, site activities, supplier paperwork, and return control."
      submitLabel={initial ? "Save changes" : "Create Request"}
      submitDisabled={!valid}
      submitting={isSubmitting}
      error={error}
      onSubmit={() => {
        onSubmit({
          title: title.trim(),
          equipmentName: equipmentName.trim(),
          equipmentType: equipmentType.trim(),
          quantity: Number(quantity),
          supplier: supplier.trim() || null,
          priority,
          neededFrom,
          neededUntil,
          estimatedCost: Number(estimatedCost || 0),
          currency: requestCurrency as "NGN" | "USD",
          deliveryLocation: deliveryLocation.trim() || null,
          operatorRequired,
          notes: notes.trim() || null,
        });
      }}
      footerVariant="stacked"
    >
      <TextInput
        label="Title"
        value={title}
        onChange={setTitle}
        placeholder="e.g Crane for roof truss"
        autoFocus
      />

      <TextInput
        label="Equipment"
        value={equipmentName}
        onChange={setEquipmentName}
        placeholder="Mobile Crane"
      />

      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          type="number"
          min="0"
          step="any"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">Priority</label>
          <Select
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(v) => v && setPriority(v as RequestPriority)}
            placeholder="Select priority"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="eq-needed-from" className="text-[13px] font-medium text-[#1E1E1E]">
            Needed from
          </label>
          <div
            className="relative"
            onClick={(e) =>
              (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.showPicker?.()
            }
          >
            <input
              id="eq-needed-from"
              type="date"
              value={neededFrom}
              onChange={(e) => setNeededFrom(e.target.value)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              placeholder="DD/MM/YY"
              className="h-11 w-full cursor-pointer border border-[#EBEBEB] bg-white px-3.5 pr-9 text-caption-l text-black-500 outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-black-500 focus:ring-1 focus:ring-black-500/10 [&::-webkit-calendar-picker-indicator]:hidden"
            />
            <ReactSVG
              src={icons2.calendar}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="eq-needed-until" className="text-[13px] font-medium text-[#1E1E1E]">
            Needed until
          </label>
          <div
            className="relative"
            onClick={(e) =>
              (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.showPicker?.()
            }
          >
            <input
              id="eq-needed-until"
              type="date"
              value={neededUntil}
              onChange={(e) => setNeededUntil(e.target.value)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              placeholder="DD/MM/YY"
              className="h-11 w-full cursor-pointer border border-[#EBEBEB] bg-white px-3.5 pr-9 text-caption-l text-black-500 outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-black-500 focus:ring-1 focus:ring-black-500/10 [&::-webkit-calendar-picker-indicator]:hidden"
            />
            <ReactSVG
              src={icons2.calendar}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
            />
          </div>
        </div>
      </div>

      <TextInput
        label="Supplier"
        optional
        value={supplier}
        onChange={setSupplier}
        placeholder="Name of Supplier"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[#1E1E1E]">Estimated Cost</label>
        <div className="flex">
          <div className="w-28 shrink-0">
            <Select
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              value={requestCurrency}
              onChange={(v) => v && setRequestCurrency(v)}
            />
          </div>
          <div className="flex-1">
            <MoneyInput
              placeholder="0"
              value={estimatedCost}
              onChange={setEstimatedCost}
              currencySymbol={currencySymbol(requestCurrency)}
              aria-label="Estimated cost"
              className="rounded-none indent-4 border border-border bg-white px-3.5 text-[14px] text-left text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none transition-colors focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#1E1E1E]">Operator Required</span>
        <button
          type="button"
          role="switch"
          aria-checked={operatorRequired}
          aria-label="Operator required"
          onClick={() => setOperatorRequired((v) => !v)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#004DE7]/30",
            operatorRequired ? "bg-[#004DE7]" : "bg-[#D1D5DB]",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
              operatorRequired ? "left-[22px]" : "left-0.5",
            )}
          />
        </button>
      </div>

      <TextInput
        label="Delivery Location"
        value={deliveryLocation}
        onChange={setDeliveryLocation}
        placeholder="Site store, gate,..."
      />

      <TextArea
        label="Lifecycle Notes"
        value={notes}
        onChange={setNotes}
        rows={5}
      />
    </FormDrawer>
  );
}
