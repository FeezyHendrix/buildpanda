import { useUrlState } from "@/hooks/use-url-state";
import { useMemo, useState, type ReactNode } from "react";
import { CreateButton } from "@/components/molecules/create-button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import { QueryError } from "@/components/molecules/query-error";
import { UnavailableRecord } from "@/components/molecules/unavailable-record";
import { ReasonDialog } from "@/components/molecules/reason-dialog";
import {
  useCancelPurchaseOrder,
  useClosePurchaseOrder,
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  useIssuePurchaseOrder,
  usePurchaseOrders,
  useReceivePurchaseOrder,
  useUpdatePurchaseOrder,
  type PurchaseOrder,
  type ReceivePurchaseOrderInput,
} from "@/hooks/use-purchase-orders";
import { useProjectContext } from "@/layouts/project-layout";
import { errorMessage } from "@/lib/api-error";
import { formatLongDate } from "@/lib/formatters";
import { downloadCsv } from "@/lib/download-csv";
import { canResourceAction } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { PurchaseOrderDrawer } from "./purchase-orders/purchase-order-drawer";
import { PurchaseOrdersTable } from "./purchase-orders/purchase-orders-table";
import { ReceivePurchaseOrderDialog } from "./purchase-orders/receive-purchase-order-dialog";
import {
  PO_STATUS_META,
  toInput,
  toValues,
  type PurchaseOrderAction,
  type UpsertPurchaseOrderValues,
} from "./purchase-orders/purchase-order-model";
import { PoSummary } from "./purchase-orders/po-summary";
import { PoToolbar } from "./purchase-orders/po-toolbar";
import { UpsertPurchaseOrderDialog } from "./purchase-orders/upsert-purchase-order-dialog";

const EMPTY_PURCHASE_ORDERS: PurchaseOrder[] = [];
const PAGE_SIZE = 10;

/** Search by PO number, vendor or stage; the date range is on the expected date. */
function matches(po: PurchaseOrder, query: string, from: string, to: string): boolean {
  if (query && ![po.poNumber, po.vendorName, po.stageName ?? ""].some((text) => text.toLowerCase().includes(query))) return false;
  if (!from && !to) return true;
  const expected = po.expectedDate?.slice(0, 10);
  if (!expected) return false;
  return (!from || expected >= from) && (!to || expected <= to);
}

type PoDialog =
  | { kind: "create" }
  | { kind: "edit"; purchaseOrder: PurchaseOrder }
  | { kind: "detail"; purchaseOrder: PurchaseOrder }
  | { kind: "receive"; purchaseOrder: PurchaseOrder }
  | { kind: "cancel"; purchaseOrder: PurchaseOrder }
  | { kind: "delete"; purchaseOrder: PurchaseOrder }
  | null;

/**
 * Purchase orders — vendor POs that become committed spend once they are
 * issued. The page's tab switch arrives as `tabs` because it shares a row with
 * this tab's action.
 */
export function PurchaseOrdersTab({ tabs }: { tabs: ReactNode }) {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const currency = project.currency;
  const { data: purchaseOrders = EMPTY_PURCHASE_ORDERS, isPending, isSuccess, error, refetch } = usePurchaseOrders(project.id);

  const [selectedId, setSelectedId] = useUrlState<string | null>("po", null);
  const [actionDialog, setDialog] = useState<PoDialog>(null);
  const selected = purchaseOrders.find(po => po.id === selectedId);
  const unavailable = Boolean(selectedId) && isSuccess && !selected;
  const dialog: PoDialog = actionDialog ?? (selected ? { kind: "detail", purchaseOrder: selected } : null);
  const [busyAction, setBusyAction] = useState<PurchaseOrderAction | null>(null);

  const createPurchaseOrder = useCreatePurchaseOrder();
  const updatePurchaseOrder = useUpdatePurchaseOrder();
  const deletePurchaseOrder = useDeletePurchaseOrder();
  const issuePurchaseOrder = useIssuePurchaseOrder();
  const receivePurchaseOrder = useReceivePurchaseOrder();
  const cancelPurchaseOrder = useCancelPurchaseOrder();
  const closePurchaseOrder = useClosePurchaseOrder();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const query = search.trim().toLowerCase();
  const isFiltered = query.length > 0 || dateFrom !== "" || dateTo !== "";
  const visible = useMemo(
    () => purchaseOrders.filter((po) => matches(po, query, dateFrom, dateTo)),
    [purchaseOrders, query, dateFrom, dateTo],
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / PAGE_SIZE)));
  const paged = useMemo(() => visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [visible, currentPage]);

  function clearFilters(): void {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function exportCsv(): void {
    downloadCsv("purchase-orders.csv", [
      ["PO number", "Vendor", "Stage", "Status", "Order date", "Expected", "Value", "Received"],
      ...visible.map((po) => [
        po.poNumber,
        po.vendorName,
        po.stageName ?? "",
        PO_STATUS_META[po.status].label,
        formatLongDate(po.orderDate),
        formatLongDate(po.expectedDate),
        po.total,
        po.receivedTotal,
      ]),
    ]);
  }

  function close(): void {
    setSelectedId(null);
    setDialog(null);
  }

  function upsert(values: UpsertPurchaseOrderValues): void {
    if (dialog?.kind === "edit") {
      updatePurchaseOrder.mutate(
        { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id, ...toInput(values) },
        { onSuccess: close, onError: (error) => toast(errorMessage(error)) },
      );
      return;
    }
    createPurchaseOrder.mutate(
      { projectId: project.id, ...toInput(values) },
      { onSuccess: close },
    );
  }

  function runAction(purchaseOrder: PurchaseOrder, action: PurchaseOrderAction): void {
    if (action === "receive") {
      setDialog({ kind: "receive", purchaseOrder });
      return;
    }
    if (action === "cancel") {
      setDialog({ kind: "cancel", purchaseOrder });
      return;
    }
    const variables = { projectId: project.id, purchaseOrderId: purchaseOrder.id };
    const options = {
      onSuccess: () => {
        setBusyAction(null);
        toast(action === "issue" ? "Purchase order issued" : "Purchase order closed", "success");
      },
      onError: (error: unknown) => {
        setBusyAction(null);
        toast(errorMessage(error));
      },
    };
    setBusyAction(action);
    if (action === "issue") issuePurchaseOrder.mutate(variables, options);
    else closePurchaseOrder.mutate(variables, options);
  }

  function receive(values: ReceivePurchaseOrderInput): void {
    if (dialog?.kind !== "receive") return;
    receivePurchaseOrder.mutate(
      { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id, ...values },
      {
        onSuccess: (purchaseOrder) => {
          close();
          toast(
            purchaseOrder.overReceipt
              ? "Receipt recorded — flagged as an over-receipt."
              : "Receipt recorded",
            "success",
          );
        },
      },
    );
  }

  const isUpsert = dialog?.kind === "create" || dialog?.kind === "edit";
  const upsertError = dialog?.kind === "edit" ? updatePurchaseOrder.error : createPurchaseOrder.error;

  return (
    <section aria-label="Purchase orders">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tabs}
        {canManage ? (
          <CreateButton onClick={() => setDialog({ kind: "create" })} className="h-[36px] gap-[8px] px-[16px] text-[14px] font-semibold">
            New Purchase Order
          </CreateButton>
        ) : null}
      </div>

      {isSuccess ? (
        <div className="mt-[24px]">
          <PoSummary purchaseOrders={purchaseOrders} currency={currency} />
        </div>
      ) : null}

      <div className="mt-[24px]">
        <PoToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setPage(1);
          }}
          onExport={exportCsv}
          canExport={visible.length > 0}
        />
      </div>

      {error ? <QueryError error={error} retry={refetch} noun="purchase orders" /> : null}
      {unavailable ? <UnavailableRecord name="Purchase order" returnLabel="Return to purchase orders" onReturn={close} /> : null}
      {!error && !unavailable ? (
        <div className="mt-[16px]">
          <PurchaseOrdersTable
            purchaseOrders={paged}
            isPending={isPending}
            isFiltered={isFiltered}
            canManage={canManage}
            currency={currency}
            onCreate={() => setDialog({ kind: "create" })}
            onClearFilters={clearFilters}
            onOpen={(purchaseOrder) => setSelectedId(purchaseOrder.id)}
            onEdit={(purchaseOrder) => setDialog({ kind: "edit", purchaseOrder })}
            onDelete={(purchaseOrder) => setDialog({ kind: "delete", purchaseOrder })}
            onAction={runAction}
          />
          {visible.length > 0 ? (
            <NumberedPagination page={currentPage} pageSize={PAGE_SIZE} total={visible.length} noun="Purchase Orders" onPageChange={setPage} />
          ) : null}
        </div>
      ) : null}

      <UpsertPurchaseOrderDialog
        projectId={project.id}
        open={isUpsert}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        mode={dialog?.kind === "edit" ? "edit" : "create"}
        initial={dialog?.kind === "edit" ? toValues(dialog.purchaseOrder) : undefined}
        onSubmit={upsert}
        isSubmitting={createPurchaseOrder.isPending || updatePurchaseOrder.isPending}
        error={upsertError ? errorMessage(upsertError) : null}
        currency={currency}
      />

      {dialog?.kind === "detail" ? (
        <PurchaseOrderDrawer
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          purchaseOrder={dialog.purchaseOrder}
          currency={currency}
          canManage={canManage}
          busyAction={busyAction}
          onEdit={() => setDialog({ kind: "edit", purchaseOrder: dialog.purchaseOrder })}
          onAction={(action) => runAction(dialog.purchaseOrder, action)}
        />
      ) : null}

      {dialog?.kind === "receive" ? (
        <ReceivePurchaseOrderDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          purchaseOrder={dialog.purchaseOrder}
          currency={currency}
          onSubmit={receive}
          isSubmitting={receivePurchaseOrder.isPending}
          error={receivePurchaseOrder.error ? errorMessage(receivePurchaseOrder.error) : null}
        />
      ) : null}

      {dialog?.kind === "cancel" ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title="Cancel this purchase order?"
          description="The PO stays on file as cancelled with your reason, and stops counting as committed spend. It cannot be un-cancelled."
          label="Why is it being cancelled?"
          placeholder="Raised in error, vendor changed, order superseded…"
          submitLabel="Cancel PO"
          isSubmitting={cancelPurchaseOrder.isPending}
          error={cancelPurchaseOrder.error ? errorMessage(cancelPurchaseOrder.error) : null}
          onSubmit={(reason) =>
            cancelPurchaseOrder.mutate(
              { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id, reason },
              {
                onSuccess: () => {
                  close();
                  toast("Purchase order cancelled", "success");
                },
              },
            )
          }
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title="Delete this draft PO?"
        description="Only a draft can be deleted. An issued PO is cancelled with a reason so the record survives."
        confirmLabel="Delete"
        variant="danger"
        loading={deletePurchaseOrder.isPending}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          deletePurchaseOrder.mutate(
            { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id },
            { onSuccess: close, onError: (error) => toast(errorMessage(error)) },
          );
        }}
      />
    </section>
  );
}

PurchaseOrdersTab.displayName = "PurchaseOrdersTab";
