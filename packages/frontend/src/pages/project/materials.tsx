import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { FormDrawer } from "@/components/molecules/form-drawer";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateMaterialOrder,
  useDeleteMaterialOrder,
  useMaterialOrders,
  useUpdateMaterialOrder,
  type MaterialOrderInput,
} from "@/hooks/use-materials-equipment";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MaterialOrder, MaterialOrderStatus, RequestPriority } from "@/lib/project-types";

const STATUS_META: Record<MaterialOrderStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Requested: { label: "Requested", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Ordered: { label: "Ordered", tone: "warning" },
  PartiallyDelivered: { label: "Partially delivered", tone: "warning" },
  Delivered: { label: "Delivered", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

const STATUS_FILTERS: Array<MaterialOrderStatus | "all"> = [
  "all",
  "Requested",
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
];

const FIELD = "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextWeek(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  return formatShortDate(value) || "Not set";
}

function nextStatus(status: MaterialOrderStatus): MaterialOrderStatus | null {
  switch (status) {
    case "Draft":
      return "Requested";
    case "Requested":
      return "Approved";
    case "Approved":
      return "Ordered";
    case "Ordered":
      return "PartiallyDelivered";
    case "PartiallyDelivered":
      return "Delivered";
    case "Delivered":
    case "Cancelled":
      return null;
  }
}

export default function ProjectMaterials() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const [filter, setFilter] = useState<MaterialOrderStatus | "all">("all");
  const { data: orders = [], isLoading } = useMaterialOrders(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialOrder | null>(null);
  const createOrder = useCreateMaterialOrder();
  const updateOrder = useUpdateMaterialOrder();
  const deleteOrder = useDeleteMaterialOrder();

  const committed = orders.reduce((sum, order) => sum + order.estimatedCost, 0);
  const received = orders.filter((order) => order.status === "Delivered").length;
  const critical = orders.filter((order) => order.priority === "Critical").length;

  function upsert(values: MaterialOrderInput): void {
    if (editTarget) {
      updateOrder.mutate(
        { projectId: project.id, orderId: editTarget.id, ...values },
        { onSuccess: () => setEditTarget(null) },
      );
      return;
    }
    createOrder.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateOpen(false) });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Materials & equipment"
        description="Request materials, track deliveries, and connect every order to phases, site activities, receipts, and project cost control."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/project/${project.id}/equipment-requests`}
              className="inline-flex h-[50px] items-center justify-center gap-2.5 rounded-lg bg-[#F6F6F6] px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-200"
            >
              Equipment requests
              <ChevronRightIcon className="size-4" />
            </Link>
            {canManage && (
              <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                New material order
              </Button>
            )}
          </div>
        }
      />

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard label="Open material orders" value={orders.length.toString()} helper="Requests through delivery" />
        <MetricCard label="Committed material cost" value={formatCurrency(committed, project.currency, { compact: true })} helper="Estimated against finance" />
        <MetricCard label="Lifecycle health" value={`${received} delivered`} helper={critical ? `${critical} critical priority` : "No critical orders"} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="lg" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Material orders & requests</h2>
              <p className="mt-0.5 text-xs text-gray-500">Every row carries schedule, activity, document, and finance context.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    filter === item ? "bg-[#004DE7] text-white" : "bg-[#F6F6F6] text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {item === "all" ? "All" : STATUS_META[item].label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading material orders…</p>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<MaterialsIcon className="size-8 text-gray-300" />}
              title="No material orders yet"
              description="Create the first request and tie it to the phase and site activity it unlocks."
              action={<Button onClick={() => setCreateOpen(true)}>Create order</Button>}
              className="py-10"
            />
          ) : (
            <div className="flex flex-col divide-y divide-[#F0F0F0]">
              {orders.map((order) => (
                <MaterialOrderRow
                  key={order.id}
                  order={order}
                  onEdit={() => setEditTarget(order)}
                  onDelete={() => setDeleteTarget(order)}
                  onAdvance={(status) =>
                    updateOrder.mutate({ projectId: project.id, orderId: order.id, status })
                  }
                />
              ))}
            </div>
          )}
        </Card>

        <LifecyclePanel projectId={project.id} orders={orders} />
      </section>

      <MaterialOrderDialog
        open={createOpen || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        initial={editTarget}
        onSubmit={upsert}
        isSubmitting={createOrder.isPending || updateOrder.isPending}
        error={((createOrder.error ?? updateOrder.error) as Error | null)?.message ?? null}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete material order?"
        description="This removes the material request from the lifecycle board. Delivered finance receipts remain in finance history."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteOrder.mutate({ projectId: project.id, orderId: deleteTarget.id }, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
      />
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </Card>
  );
}

function MaterialOrderRow({
  order,
  onEdit,
  onDelete,
  onAdvance,
}: {
  order: MaterialOrder;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: (status: MaterialOrderStatus) => void;
}) {
  const next = nextStatus(order.status);
  return (
    <article className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconBox tone={order.priority === "Critical" ? "red" : "orange"} size="sm" icon={<MaterialsIcon className="size-4" />} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{order.title}</h3>
            <Badge tone={STATUS_META[order.status].tone}>{STATUS_META[order.status].label}</Badge>
            <Badge tone={order.priority === "Critical" ? "danger" : "neutral"} variant="outline">{order.priority}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-600 text-pretty">
            {order.quantity} {order.unit} · {order.materialName}{order.supplier ? ` from ${order.supplier}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Needed {formatDate(order.neededBy)}</span>
            <span>Phase: {order.phaseName ?? "Unlinked"}</span>
            <span>Activity: {order.activityName ?? "Unlinked"}</span>
            <span>Doc: {order.documentName ?? "No receipt/spec"}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        <p className="mr-2 text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(order.estimatedCost, order.currency)}</p>
        {next && <Button size="sm" variant="secondary" onClick={() => onAdvance(next)}>Move to {STATUS_META[next].label}</Button>}
        <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
      </div>
    </article>
  );
}

function LifecyclePanel({ projectId, orders }: { projectId: string; orders: MaterialOrder[] }) {
  const awaiting = orders.filter((order) => ["Requested", "Approved", "Ordered", "PartiallyDelivered"].includes(order.status));
  return (
    <aside className="flex flex-col gap-4">
      <Card padding="lg" className="bg-[#0F172A] text-white">
        <div className="flex items-start gap-3">
          <IconBox tone="brand" size="sm" icon={<CalendarIcon className="size-4" />} />
          <div>
            <h2 className="text-base font-semibold">Construction lifecycle links</h2>
            <p className="mt-2 text-sm text-white/70 text-pretty">
              Material requests are not standalone: they unblock schedule activities, create finance receipts when delivered, and point back to supporting specs or receipts.
            </p>
          </div>
        </div>
      </Card>
      <Card padding="lg">
        <h2 className="text-sm font-semibold text-gray-900">Next procurement actions</h2>
        <ul className="mt-3 flex flex-col divide-y divide-[#F0F0F0]">
          {awaiting.slice(0, 5).map((order) => (
            <li key={order.id} className="py-3">
              <p className="text-sm font-medium text-gray-900">{order.materialName}</p>
              <p className="mt-1 text-xs text-gray-500">{STATUS_META[order.status].label} · needed {formatDate(order.neededBy)}</p>
            </li>
          ))}
          {awaiting.length === 0 && <li className="py-3 text-sm text-gray-500">No material blockers right now.</li>}
        </ul>
      </Card>
      <Card padding="lg">
        <h2 className="text-sm font-semibold text-gray-900">Connected workspaces</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/activities`}>Site activities</Link>
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/finances`}>Finance receipts</Link>
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/documents`}>Specifications & receipts</Link>
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/daily-log`}>Daily delivery log</Link>
        </div>
      </Card>
    </aside>
  );
}

interface MaterialOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: MaterialOrder | null;
  onSubmit: (values: MaterialOrderInput) => void;
  isSubmitting: boolean;
  error: string | null;
}

function MaterialOrderDialog({ open, onOpenChange, initial, onSubmit, isSubmitting, error }: MaterialOrderDialogProps) {
  const [title, setTitle] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("bags");
  const [supplier, setSupplier] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededBy, setNeededBy] = useState(nextWeek());
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setMaterialName(initial?.materialName ?? "");
    setQuantity(String(initial?.quantity ?? 1));
    setUnit(initial?.unit ?? "bags");
    setSupplier(initial?.supplier ?? "");
    setPriority(initial?.priority ?? "Normal");
    setNeededBy(initial?.neededBy.slice(0, 10) ?? nextWeek());
    setEstimatedCost(String(initial?.estimatedCost ?? 0));
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial, open]);

  const valid = title.trim() && materialName.trim() && Number(quantity) > 0 && unit.trim() && neededBy;
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit material order" : "New material order"}
      description="Connect the request to the work it unlocks, then move it through approval, order, and delivery."
      submitLabel={initial ? "Save changes" : "Create order"}
      submitDisabled={!valid}
      submitting={isSubmitting}
      error={error}
      onSubmit={() => {
        onSubmit({
          title: title.trim(),
          materialName: materialName.trim(),
          quantity: Number(quantity),
          unit: unit.trim(),
          supplier: supplier.trim() || null,
          priority,
          neededBy,
          estimatedCost: Number(estimatedCost || 0),
          currency: "NGN",
          deliveryLocation: deliveryLocation.trim() || null,
          notes: notes.trim() || null,
        });
      }}
    >
      <Field label="Title" id="mat-title" value={title} onChange={setTitle} placeholder="e.g. Cement for first-floor blockwork" />
      <Field label="Material" id="mat-name" value={materialName} onChange={setMaterialName} placeholder="Dangote cement 42.5" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" id="mat-quantity" value={quantity} onChange={setQuantity} type="number" />
        <Field label="Unit" id="mat-unit" value={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-priority">Priority</Label>
          <select id="mat-priority" value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)} className={FIELD}>
            {(["Low", "Normal", "High", "Critical"] as RequestPriority[]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <Field label="Needed by" id="mat-needed" value={neededBy || today()} onChange={setNeededBy} type="date" />
      </div>
      <Field label="Supplier" id="mat-supplier" value={supplier} onChange={setSupplier} placeholder="Optional" />
      <Field label="Estimated cost" id="mat-cost" value={estimatedCost} onChange={setEstimatedCost} type="number" />
      <Field label="Delivery location" id="mat-location" value={deliveryLocation} onChange={setDeliveryLocation} placeholder="Site store, gate, yard…" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-notes">Lifecycle notes</Label>
        <textarea id="mat-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10" />
      </div>
    </FormDrawer>
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
