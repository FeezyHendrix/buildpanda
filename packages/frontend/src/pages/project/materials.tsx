import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { SearchInput } from "@/components/atoms/search-input";
import { ChevronRightIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { ImportBoqDialog } from "@/components/molecules/import-boq-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { SimpleDropdown } from "@/components/molecules/simple-dropdown";
import { toast } from "@/lib/toast";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateMaterialOrder,
  useDeleteMaterialOrder,
  useMaterialOrders,
  useUpdateMaterialOrder,
  type MaterialOrderInput,
} from "@/hooks/use-materials-equipment";
import { formatCurrency } from "@/lib/formatters";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { MaterialsTable } from "./materials/materials-table";
import { MaterialOrderDialog } from "./materials/material-order-dialog";
import {
  ALL_SUPPLIERS,
  LATE_FILTER_OPTIONS,
  STATUS_FILTER_ITEMS,
  matchesOrderSearch,
  supplierLabel,
  supplierOptions,
  type LateFilter,
} from "./materials/shared";

export default function ProjectMaterials() {
  const { project, access } = useProjectContext();
  const canRequest = canResourceAction(access, "materials", "request");
  const canApprove = canResourceAction(access, "materials", "approve");
  // The whole register is fetched once; status, supplier, late and search all
  // narrow it here so the KPI strip and the "x of y" count stay stable.
  const { data: orders = [], isLoading } = useMaterialOrders(project.id);

  const [status, setStatus] = useState<MaterialOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState<string>(ALL_SUPPLIERS);
  const [lateFilter, setLateFilter] = useState<LateFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialOrder | null>(null);
  const createOrder = useCreateMaterialOrder();
  const updateOrder = useUpdateMaterialOrder();
  const deleteOrder = useDeleteMaterialOrder();

  const committed = orders.reduce((sum, order) => sum + order.estimatedCost, 0);
  const received = orders.filter((order) => order.status === "Delivered").length;
  const critical = orders.filter((order) => order.priority === "Critical").length;
  const lateCount = orders.filter((order) => order.late).length;

  const suppliers = useMemo(() => supplierOptions(orders), [orders]);
  const filtered = orders
    .filter((order) => status === "all" || order.status === status)
    .filter((order) => supplier === ALL_SUPPLIERS || supplierLabel(order) === supplier)
    .filter((order) => lateFilter === "all" || order.late)
    .filter((order) => matchesOrderSearch(order, search));

  const isFiltered =
    status !== "all" || supplier !== ALL_SUPPLIERS || lateFilter !== "all" || search.trim() !== "";

  function clearFilters(): void {
    setStatus("all");
    setSupplier(ALL_SUPPLIERS);
    setLateFilter("all");
    setSearch("");
  }

  function upsert(values: MaterialOrderInput): void {
    if (editTarget) {
      updateOrder.mutate(
        { projectId: project.id, orderId: editTarget.id, ...values },
        { onSuccess: () => setEditTarget(null) },
      );
      return;
    }
    createOrder.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Materials & equipment"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/project/${project.id}/equipment-requests`}
              className="inline-flex h-[32px] items-center justify-center gap-2.5 rounded-lg bg-surface-alt px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-200"
            >
              Equipment requests
              <ChevronRightIcon className="size-4" />
            </Link>
            {canRequest ? (
              <Button variant="secondary" size="md" onClick={() => setImportOpen(true)}>
                Import from BoQ
              </Button>
            ) : null}
            {canRequest ? (
              <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                New material order
              </Button>
            ) : null}
          </div>
        }
      />

      <section aria-label="Material summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Open material orders"
          value={orders.length.toString()}
          helper={lateCount > 0 ? `${lateCount} running late` : "Requests through delivery"}
        />
        <KpiCard
          label="Committed material cost"
          value={formatCurrency(committed, project.currency, { compact: true })}
          helper="Estimated against finance"
        />
        <KpiCard
          label="Lifecycle health"
          value={`${received} delivered`}
          helper={critical ? `${critical} critical priority` : "No critical orders"}
        />
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs rounded-lg border border-line-hair bg-white">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by material or supplier"
            aria-label="Search material orders"
          />
        </div>
        <FilterTabs
          items={STATUS_FILTER_ITEMS}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter material orders by status"
        />
        <SimpleDropdown
          options={suppliers}
          value={supplier}
          onChange={setSupplier}
          ariaLabel="Filter by supplier"
        />
        <SimpleDropdown
          options={LATE_FILTER_OPTIONS}
          value={lateFilter}
          onChange={setLateFilter}
          ariaLabel="Filter late orders"
        />
        <span className="ml-auto text-sm text-ink-muted">
          {filtered.length} of {orders.length} order{orders.length === 1 ? "" : "s"}
        </span>
      </div>

      <MaterialsTable
        orders={filtered}
        isFiltered={isFiltered}
        isLoading={isLoading}
        canRequest={canRequest}
        canApprove={canApprove}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
        onAdvance={(order, next) =>
          updateOrder.mutate({ projectId: project.id, orderId: order.id, status: next })
        }
        onCreate={() => setCreateOpen(true)}
        onClearFilters={clearFilters}
      />

      <ImportBoqDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={project.id}
        currency={project.currency}
        onImported={(count) =>
          toast(`Added ${count} material${count === 1 ? "" : "s"} from the BoQ.`, "success")
        }
      />

      <MaterialOrderDialog
        open={createOpen || editTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        projectId={project.id}
        initial={editTarget}
        onSubmit={upsert}
        isSubmitting={createOrder.isPending || updateOrder.isPending}
        error={
          editTarget
            ? ((updateOrder.error as Error | null)?.message ?? null)
            : ((createOrder.error as Error | null)?.message ?? null)
        }
        currency={project.currency}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete material order?"
        description="This removes the material request from the lifecycle board. Delivered finance receipts remain in finance history."
        confirmLabel="Delete"
        loading={deleteOrder.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteOrder.mutate(
              { projectId: project.id, orderId: deleteTarget.id },
              { onSuccess: () => setDeleteTarget(null) },
            );
          }
        }}
      />
    </div>
  );
}
