import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { IconBox } from "@/components/atoms/icon-box";
import { Label } from "@/components/atoms/label";
import {
  CalendarIcon,
  ChevronRightIcon,
  MaterialsIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDialog } from "@/components/molecules/form-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateEquipmentRequest,
  useDeleteEquipmentRequest,
  useEquipmentRequests,
  useUpdateEquipmentRequest,
  type EquipmentRequestInput,
} from "@/hooks/use-materials-equipment";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { EquipmentBucket, EquipmentRequest, EquipmentRequestStatus, RequestPriority } from "@/lib/project-mock-data";

const BUCKETS: Array<{ bucket: EquipmentBucket; label: string; helper: string }> = [
  { bucket: "requests", label: "Requests", helper: "New rental needs" },
  { bucket: "approvals", label: "Approvals", helper: "Awaiting go-ahead" },
  { bucket: "schedule", label: "Schedule", helper: "Approved to book" },
  { bucket: "on-hire", label: "On hire", helper: "Mobilized to site" },
  { bucket: "returns", label: "Returns", helper: "Closed or cancelled" },
];

const DEFAULT_BUCKET_META = BUCKETS[0]!;

const STATUS_META: Record<EquipmentRequestStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Requested: { label: "Requested", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Scheduled: { label: "Scheduled", tone: "warning" },
  OnHire: { label: "On hire", tone: "warning" },
  Returned: { label: "Returned", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

const FIELD = "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

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

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function defaultFrom(): string {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function defaultUntil(): string {
  return new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function ProjectEquipmentRequests() {
  const { project } = useProjectContext();
  const params = useParams<{ bucket?: EquipmentBucket }>();
  const activeBucket = BUCKETS.some((item) => item.bucket === params.bucket) ? params.bucket : "requests";
  const activeMeta = BUCKETS.find((item) => item.bucket === activeBucket) ?? DEFAULT_BUCKET_META;
  const { data: requests = [], isLoading } = useEquipmentRequests(project.id, activeBucket);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentRequest | null>(null);
  const createRequest = useCreateEquipmentRequest();
  const updateRequest = useUpdateEquipmentRequest();
  const deleteRequest = useDeleteEquipmentRequest();

  function upsert(values: EquipmentRequestInput): void {
    if (editTarget) {
      updateRequest.mutate(
        { projectId: project.id, requestId: editTarget.id, ...values },
        { onSuccess: () => setEditTarget(null) },
      );
      return;
    }
    createRequest.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateOpen(false) });
  }

  const bookedCost = requests.reduce((sum, request) => sum + request.estimatedCost, 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Rental / equipment requests"
        description="Manage equipment from field request through approval, booking, site use, and return so machinery never sits outside the build plan."
        badges={<Badge tone="info">{activeMeta.label}</Badge>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/project/${project.id}/materials`}
              className="inline-flex h-[50px] items-center justify-center gap-2.5 rounded-lg bg-[#F6F6F6] px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-200"
            >
              Materials
              <ChevronRightIcon className="size-4" />
            </Link>
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              New equipment request
            </Button>
          </div>
        }
      />

      <nav className="mt-8 grid gap-3 md:grid-cols-5" aria-label="Equipment request routes">
        {BUCKETS.map((item) => (
          <Link
            key={item.bucket}
            to={`/project/${project.id}/equipment-requests/${item.bucket}`}
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              activeBucket === item.bucket ? "border-[#004DE7] bg-[#E6EFFE]" : "border-[#EDEDED] bg-white hover:bg-gray-50",
            )}
          >
            <p className="text-sm font-semibold text-gray-900">{item.label}</p>
            <p className="mt-1 text-xs text-gray-500">{item.helper}</p>
          </Link>
        ))}
      </nav>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric label="Visible requests" value={requests.length.toString()} helper={activeMeta.helper} />
        <Metric label="Booked cost" value={formatCurrency(bookedCost, project.currency, { compact: true })} helper="Estimated hire spend" />
        <Metric label="Lifecycle stage" value={activeMeta.label} helper="Derived from status" />
      </section>

      <Card padding="lg" className="mt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{activeMeta.label}</h2>
            <p className="mt-0.5 text-xs text-gray-500">Equipment requests stay linked to phases, activities, supplier docs, and site dates.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading equipment requests…</p>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<MaterialsIcon className="size-8 text-gray-300" />}
            title="No equipment requests here"
            description="Create a rental request or move existing equipment through the lifecycle."
            action={<Button onClick={() => setCreateOpen(true)}>Create request</Button>}
            className="py-10"
          />
        ) : (
          <div className="flex flex-col divide-y divide-[#F0F0F0]">
            {requests.map((request) => (
              <EquipmentRow
                key={request.id}
                request={request}
                onEdit={() => setEditTarget(request)}
                onDelete={() => setDeleteTarget(request)}
                onAdvance={(status) => updateRequest.mutate({ projectId: project.id, requestId: request.id, status })}
              />
            ))}
          </div>
        )}
      </Card>

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
        error={((createRequest.error ?? updateRequest.error) as Error | null)?.message ?? null}
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

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </Card>
  );
}

function EquipmentRow({
  request,
  onEdit,
  onDelete,
  onAdvance,
}: {
  request: EquipmentRequest;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: (status: EquipmentRequestStatus) => void;
}) {
  const next = nextStatus(request.status);
  return (
    <article className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconBox tone={request.priority === "Critical" ? "red" : "brand"} size="sm" icon={<CalendarIcon className="size-4" />} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{request.title}</h3>
            <Badge tone={STATUS_META[request.status].tone}>{STATUS_META[request.status].label}</Badge>
            <Badge tone={request.operatorRequired ? "warning" : "neutral"} variant="outline">
              {request.operatorRequired ? "Operator required" : request.equipmentType}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-600 text-pretty">
            {request.quantity} × {request.equipmentName}{request.supplier ? ` from ${request.supplier}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>{formatDate(request.neededFrom)} → {formatDate(request.neededUntil)}</span>
            <span>Phase: {request.phaseName ?? "Unlinked"}</span>
            <span>Activity: {request.activityName ?? "Unlinked"}</span>
            <span>Doc: {request.documentName ?? "No supplier doc"}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        <p className="mr-2 text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(request.estimatedCost, request.currency)}</p>
        {next && <Button size="sm" variant="secondary" onClick={() => onAdvance(next)}>Move to {STATUS_META[next].label}</Button>}
        <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
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
}

function EquipmentRequestDialog({ open, onOpenChange, initial, onSubmit, isSubmitting, error }: EquipmentDialogProps) {
  const [title, setTitle] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Plant");
  const [quantity, setQuantity] = useState("1");
  const [supplier, setSupplier] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededFrom, setNeededFrom] = useState(defaultFrom());
  const [neededUntil, setNeededUntil] = useState(defaultUntil());
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
    setEstimatedCost(String(initial?.estimatedCost ?? 0));
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setOperatorRequired(initial?.operatorRequired ?? false);
    setNotes(initial?.notes ?? "");
  }, [initial, open]);

  const valid = title.trim() && equipmentName.trim() && equipmentType.trim() && Number(quantity) > 0 && neededFrom && neededUntil;
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit equipment request" : "New equipment request"}
      description="Tie equipment rentals to schedule dates, site activities, supplier paperwork, and return control."
      submitLabel={initial ? "Save changes" : "Create request"}
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
          currency: "NGN",
          deliveryLocation: deliveryLocation.trim() || null,
          operatorRequired,
          notes: notes.trim() || null,
        });
      }}
    >
      <Field label="Title" id="eq-title" value={title} onChange={setTitle} placeholder="e.g. Crane for roof truss lift" />
      <Field label="Equipment" id="eq-name" value={equipmentName} onChange={setEquipmentName} placeholder="Mobile crane" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" id="eq-type" value={equipmentType} onChange={setEquipmentType} />
        <Field label="Quantity" id="eq-quantity" value={quantity} onChange={setQuantity} type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-priority">Priority</Label>
          <select id="eq-priority" value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)} className={FIELD}>
            {(["Low", "Normal", "High", "Critical"] as RequestPriority[]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <Field label="Estimated cost" id="eq-cost" value={estimatedCost} onChange={setEstimatedCost} type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Needed from" id="eq-from" value={neededFrom} onChange={setNeededFrom} type="date" />
        <Field label="Needed until" id="eq-until" value={neededUntil} onChange={setNeededUntil} type="date" />
      </div>
      <Field label="Supplier" id="eq-supplier" value={supplier} onChange={setSupplier} placeholder="Optional" />
      <Field label="Delivery location" id="eq-location" value={deliveryLocation} onChange={setDeliveryLocation} placeholder="Site gate, crane pad…" />
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={operatorRequired} onChange={(e) => setOperatorRequired(e.target.checked)} />
        Operator required
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eq-notes">Lifecycle notes</Label>
        <textarea id="eq-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10" />
      </div>
    </FormDialog>
  );
}

function Field({ label, id, value, onChange, placeholder, type = "text" }: { label: string; id: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} className={FIELD} />
    </div>
  );
}
