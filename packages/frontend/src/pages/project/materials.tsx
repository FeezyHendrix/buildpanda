import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Select } from "@/components/atoms/select";
import { Spinner } from "@/components/atoms/spinner";
import { TextInput } from "@/components/atoms/text-input";
import { EmptyState } from "@/components/molecules/empty-state";
import { ImportBoqDialog } from "@/components/molecules/import-boq-dialog";
import { MetricCard } from "@/components/molecules/metric-card";
import { toast } from "@/lib/toast";
import { useProjectContext } from "@/layouts/project-layout";
import { useSetPageTitle } from "@/contexts/page-title-context";
import {
  useCreateMaterialOrder,
  useDeleteMaterialOrder,
  useMaterialOrders,
  useUpdateMaterialOrder,
  type MaterialOrderInput,
} from "@/hooks/use-materials-equipment";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { MaterialOrderRow } from "./materials/material-order-row";
import { LifecyclePanel } from "./materials/lifecycle-panel";
import { MaterialOrderDialog } from "./materials/material-order-dialog";
import { STATUS_META, STATUS_FILTERS } from "./materials/shared";

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

export default function ProjectMaterials() {
  useSetPageTitle(
    "Materials",
    "Request materials, track deliveries, and connect every order to phases, site activities, receipts, and project cost control.",
  );

  const { project, access } = useProjectContext();
  const canRequest = canResourceAction(access, "materials", "request");
  const canApprove = canResourceAction(access, "materials", "approve");
  const [filter, setFilter] = useState<MaterialOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: orders = [], isLoading } = useMaterialOrders(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialOrder | null>(null);
  const createOrder = useCreateMaterialOrder();
  const updateOrder = useUpdateMaterialOrder();
  const deleteOrder = useDeleteMaterialOrder();

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      [order.title, order.materialName, order.supplier ?? ""].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [orders, search]);

  const committed = orders.reduce((sum, order) => sum + order.estimatedCost, 0);
  const received = orders.filter((order) => order.status === "Delivered").length;
  const critical = orders.filter((order) => order.priority === "Critical").length;

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = visible.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, visible.length);

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
    <div className="w-full px-4 py-6 lg:px-8">
      {canRequest && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setImportOpen(true)}
          >
            <Download className="size-4" />
            Import from BOQ
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setCreateOpen(true)}
          >
            <ReactSVG
              src={icons2.plus}
              className="[&_path]:fill-white [&_svg]:size-3"
            />
            New material order
          </Button>
        </div>
      )}

      <ImportBoqDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={project.id}
        currency={project.currency}
        onImported={(count) =>
          toast(
            `Added ${count} material${count === 1 ? "" : "s"} from the BoQ.`,
            "success",
          )
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Open Material Orders"
          value={orders.length}
          helperText="Requests through delivery"
        />
        <MetricCard
          label="Committed Material Cost"
          value={formatCurrency(committed, project.currency, { compact: true })}
          helperText="Estimated against finance"
        />
        <MetricCard
          label="Lifecycle Health"
          value={`${received} delivered`}
          helperText={
            critical ? `${critical} critical priority` : "No critical orders"
          }
        />
      </section>

      <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-[#1E1E1E]">
            Orders and Requests
          </h2>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-[320px]">
              <ReactSVG
                src={icons2.search}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 shrink-0 [&_svg]:size-[18px]"
              />
              <TextInput
                type="search"
                placeholder="Search Orders and Requests"
                value={search}
                onChange={setSearch}
                aria-label="Search orders and requests"
                className="h-9 w-full indent-8"
              />
            </div>
            <Select
              options={STATUS_FILTERS.map((item) => ({
                value: item,
                label: item === "all" ? "All Orders" : STATUS_META[item].label,
              }))}
              value={filter}
              onChange={(v) => v && setFilter(v as MaterialOrderStatus | "all")}
              placeholder="All Orders"
              className="h-9 shrink-0 sm:w-[160px]"
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
                  title="No material orders yet"
                  description="Create the first request and tie it to the phase and site activity it unlocks."
                  action={
                    canRequest ? (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => setCreateOpen(true)}
                      >
                        <ReactSVG
                          src={icons2.plus}
                          className="[&_path]:fill-white [&_svg]:size-3"
                        />
                        Create order
                      </Button>
                    ) : undefined
                  }
                  className="py-10"
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {paged.map((order) => (
                    <MaterialOrderRow
                      key={order.id}
                      order={order}
                      canRequest={canRequest}
                      canApprove={canApprove}
                      onEdit={() => setEditTarget(order)}
                      onDelete={() => setDeleteTarget(order)}
                      onAdvance={(status) =>
                        updateOrder.mutate({
                          projectId: project.id,
                          orderId: order.id,
                          status,
                        })
                      }
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[#767676]">
                    Showing {showingFrom} to {showingTo} of {visible.length}{" "}
                    Orders and Requests
                  </p>
                  {totalPages > 1 && (
                    <nav
                      aria-label="Orders pages"
                      className="flex items-center gap-1"
                    >
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
                          <span
                            key={`gap-${i}`}
                            className="px-1 text-xs text-[#9CA3AF]"
                          >
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

        <LifecyclePanel projectId={project.id} orders={orders} />
      </section>

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
