import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Spinner } from "@/components/atoms/spinner";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateEquipmentRequest,
  useDeleteEquipmentRequest,
  useEquipmentRequests,
  useUpdateEquipmentRequest,
  type EquipmentRequestInput,
} from "@/hooks/use-materials-equipment";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
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

const BUCKET_TABS = BUCKETS.map((item) => ({ value: item.bucket, label: item.label }));

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

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function nextStatus(
  status: EquipmentRequestStatus,
): EquipmentRequestStatus | null {
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
  return formatShortDate(value) || "Not set";
}

function defaultFrom(): string {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function defaultUntil(): string {
  return new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export default function ProjectEquipmentRequests() {
  const { project, access } = useProjectContext();
  const canRequest = canResourceAction(access, "materials", "request");
  const canApprove = canResourceAction(access, "materials", "approve");
  const params = useParams<{ bucket?: EquipmentBucket }>();
  const navigate = useNavigate();
  const activeBucket = BUCKETS.some((item) => item.bucket === params.bucket)
    ? params.bucket
    : "requests";
  const activeMeta =
    BUCKETS.find((item) => item.bucket === activeBucket) ?? DEFAULT_BUCKET_META;
  const { data: requests = [], isLoading } = useEquipmentRequests(
    project.id,
    activeBucket,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentRequest | null>(
    null,
  );
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
    createRequest.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  const bookedCost = requests.reduce(
    (sum, request) => sum + request.estimatedCost,
    0,
  );

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Equipment requests"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="md" onClick={() => navigate(`/project/${project.id}/materials`)}>
              Materials
              <ChevronRightIcon className="size-4" />
            </Button>
            {canRequest && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon className="size-4" />
                New equipment request
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          items={BUCKET_TABS}
          value={activeBucket ?? "requests"}
          onChange={(bucket) => navigate(`/project/${project.id}/equipment-requests/${bucket}`)}
          ariaLabel="Equipment request stages"
        />
        <span className="text-sm text-gray-500">{activeMeta.helper}</span>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Visible requests"
          value={requests.length.toString()}
          helper={activeMeta.helper}
        />
        <KpiCard
          label="Booked cost"
          value={formatCurrency(bookedCost, project.currency, {
            compact: true,
          })}
          helper="Estimated hire spend"
        />
        <KpiCard
          label="Lifecycle stage"
          value={activeMeta.label}
          helper="Derived from status"
        />
      </section>

      <Card padding="lg" className="mt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {activeMeta.label}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Equipment requests stay linked to phases, activities, supplier
              docs, and site dates.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<MaterialsIcon />}
            title="No equipment requests yet"
            description="Create a rental request or move existing equipment through the lifecycle."
            action={canRequest ? { label: "Create request", onClick: () => setCreateOpen(true) } : undefined}
          />
        ) : (
          <div className="flex flex-col divide-y divide-[#F0F0F0]">
            {requests.map((request) => (
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
        error={
          ((createRequest.error ?? updateRequest.error) as Error | null)
            ?.message ?? null
        }
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
  const canAdvance = next !== null && (APPROVAL.includes(next) ? canApprove : canRequest);
  return (
    <article className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconBox
          tone={request.priority === "Critical" ? "red" : "brand"}
          size="sm"
          icon={<CalendarIcon className="size-4" />}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {request.title}
            </h3>
            <Badge tone={STATUS_META[request.status].tone}>
              {STATUS_META[request.status].label}
            </Badge>
            <Badge
              tone={request.operatorRequired ? "warning" : "neutral"}
              variant="outline"
            >
              {request.operatorRequired
                ? "Operator required"
                : request.equipmentType}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-600 text-pretty">
            {request.quantity} × {request.equipmentName}
            {request.supplier ? ` from ${request.supplier}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>
              {formatDate(request.neededFrom)} →{" "}
              {formatDate(request.neededUntil)}
            </span>
            <span>Phase: {request.phaseName ?? "Unlinked"}</span>
            <span>Activity: {request.activityName ?? "Unlinked"}</span>
            <span>Doc: {request.documentName ?? "No supplier doc"}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        <p className="mr-2 text-sm font-semibold tabular-nums text-gray-900">
          {formatCurrency(request.estimatedCost, request.currency)}
        </p>
        {next && canAdvance ? (
          <Button size="sm" variant="secondary" onClick={() => onAdvance(next)}>
            Move to {STATUS_META[next].label}
          </Button>
        ) : null}
        {canRequest ? (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {canApprove ? (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
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

function EquipmentRequestDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting,
  error,
}: EquipmentDialogProps) {
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
      <Field
        label="Title"
        id="eq-title"
        value={title}
        onChange={setTitle}
        placeholder="e.g. Crane for roof truss lift"
      />
      <Field
        label="Equipment"
        id="eq-name"
        value={equipmentName}
        onChange={setEquipmentName}
        placeholder="Mobile crane"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Type"
          id="eq-type"
          value={equipmentType}
          onChange={setEquipmentType}
        />
        <Field
          label="Quantity"
          id="eq-quantity"
          value={quantity}
          onChange={setQuantity}
          type="number"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-priority">Priority</Label>
          <select
            id="eq-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as RequestPriority)}
            className={FIELD}
          >
            {(["Low", "Normal", "High", "Critical"] as RequestPriority[]).map(
              (item) => (
                <option key={item}>{item}</option>
              ),
            )}
          </select>
        </div>
        <Field
          label="Estimated cost"
          id="eq-cost"
          value={estimatedCost}
          onChange={setEstimatedCost}
          type="number"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Needed from"
          id="eq-from"
          value={neededFrom}
          onChange={setNeededFrom}
          type="date"
        />
        <Field
          label="Needed until"
          id="eq-until"
          value={neededUntil}
          onChange={setNeededUntil}
          type="date"
        />
      </div>
      <Field
        label="Supplier"
        id="eq-supplier"
        value={supplier}
        onChange={setSupplier}
        placeholder="Optional"
      />
      <Field
        label="Delivery location"
        id="eq-location"
        value={deliveryLocation}
        onChange={setDeliveryLocation}
        placeholder="Site gate, crane pad…"
      />
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={operatorRequired}
          onChange={(e) => setOperatorRequired(e.target.checked)}
        />
        Operator required
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eq-notes">Lifecycle notes</Label>
        <textarea
          id="eq-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-24 rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className={FIELD}
      />
    </div>
  );
}
