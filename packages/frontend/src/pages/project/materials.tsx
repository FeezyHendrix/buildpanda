import { useUrlState } from "@/hooks/use-url-state";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { SearchInput } from "@/components/atoms/search-input";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { ImportBoqDialog } from "@/components/molecules/import-boq-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { SimpleDropdown } from "@/components/molecules/simple-dropdown";
import { errorMessage, getApiErrorStatus } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { useProjectContext } from "@/layouts/project-layout";
import { useUpdateMaterialOrder } from "@/hooks/use-materials-equipment";
import { formatCurrency } from "@/lib/formatters";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { useMaterialOrders } from "@/hooks/use-materials-equipment";
import { MaterialsTable } from "./materials/materials-table";
import { MaterialOrderDialogs, type OrderDialog } from "./materials/material-order-dialogs";
import {
  ALL_SUPPLIERS,
  LATE_FILTER_OPTIONS,
  STATUS_FILTER_ITEMS,
  isClosed,
  matchesOrderSearch,
  supplierLabel,
  supplierOptions,
  type LateFilter,
} from "./materials/shared";

/** Cancelled and rejected orders are on file, not on the books. */
function isLive(order: MaterialOrder): boolean {
  return order.status !== "Cancelled" && order.status !== "Rejected";
}

export default function ProjectMaterials() {
  const { project, access } = useProjectContext();
  const canRequest = canResourceAction(access, "materials", "request");
  const canApprove = canResourceAction(access, "materials", "approve");
  const canRaisePurchaseOrder = canResourceAction(access, "finances", "manage");
  // The whole register is fetched once; status, supplier, late and search all
  // narrow it here so the KPI strip and the "x of y" count stay stable.
  const { data: orders = [], isLoading } = useMaterialOrders(project.id);

  const [status, setStatus] = useUrlState<MaterialOrderStatus | "all">("status", "all");
  const [search, setSearch] = useUrlState<string>("q", "");
  const [supplier, setSupplier] = useUrlState<string>("supplier", ALL_SUPPLIERS);
  const [lateFilter, setLateFilter] = useUrlState<LateFilter>("late", "all");

  const [importOpen, setImportOpen] = useState(false);
  const [dialog, setDialog] = useState<OrderDialog>(null);
  const advanceOrder = useUpdateMaterialOrder();

  const committed = orders
    .filter(isLive)
    .reduce((sum, order) => sum + order.estimatedCost, 0);
  const open = orders.filter((order) => isLive(order) && !isClosed(order.status)).length;
  const received = orders.filter((order) => order.status === "Delivered").length;
  const critical = orders.filter((order) => isLive(order) && order.priority === "Critical").length;
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

  /**
   * Moving to Ordered is refused when the material's approval is not in hand.
   * That 409 is not an error to shout about — it is the "order anyway" prompt.
   */
  function advance(order: MaterialOrder, next: MaterialOrderStatus): void {
    advanceOrder.mutate(
      { projectId: project.id, orderId: order.id, status: next },
      {
        onError: (error) => {
          if (getApiErrorStatus(error) === 409) {
            setDialog({ kind: "force", order, message: errorMessage(error) });
            return;
          }
          toast(errorMessage(error));
        },
      },
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
              <CreateButton onClick={() => setDialog({ kind: "create" })}>
                New material order
       </CreateButton>
            ) : null}
          </div>
        }
      />

      <section aria-label="Material summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Open material orders"
          value={open.toString()}
          helper={lateCount > 0 ? `${lateCount} running late` : "Requested through ordered"}
        />
        <KpiCard
          label="Committed material cost"
          value={formatCurrency(committed, project.currency, { compact: true })}
          helper="Live orders only — cancelled ones are excluded"
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
        canRaisePurchaseOrder={canRaisePurchaseOrder}
        onOpen={(order) => setDialog({ kind: "detail", order })}
        onEdit={(order) => setDialog({ kind: "edit", order })}
        onDelete={(order) => setDialog({ kind: "delete", order })}
        onCancel={(order) => setDialog({ kind: "close", order, status: "Cancelled" })}
        onReject={(order) => setDialog({ kind: "close", order, status: "Rejected" })}
        onRecordDelivery={(order) => setDialog({ kind: "delivery", order })}
        onRaisePurchaseOrder={(order) => setDialog({ kind: "purchase-order", order })}
        onAdvance={advance}
        onCreate={() => setDialog({ kind: "create" })}
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

      <MaterialOrderDialogs
        projectId={project.id}
        currency={project.currency}
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
