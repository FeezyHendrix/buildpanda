import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useCreatePurchaseOrder, usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { TabActions } from "./finance-tabs";
import { PurchaseOrderCard } from "./purchase-orders/purchase-order-card";
import { toInput, type UpsertPurchaseOrderValues } from "./purchase-orders/purchase-order-model";
import { UpsertPurchaseOrderDialog } from "./purchase-orders/upsert-purchase-order-dialog";

/** Purchase orders — vendor POs whose line items become committed spend before invoices arrive. */
export function PurchaseOrdersTab() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const currency = project.currency;
  const { data: purchaseOrders = [], isPending } = usePurchaseOrders(project.id);
  const createPurchaseOrder = useCreatePurchaseOrder();
  const [createOpen, setCreateOpen] = useState(false);

  const summary = useMemo(() => {
    return purchaseOrders.reduce(
      (acc, purchaseOrder) => {
        acc.committed += purchaseOrder.total;
        if (purchaseOrder.status === "Issued" || purchaseOrder.status === "PartiallyReceived") {
          acc.open += purchaseOrder.total;
        }
        if (purchaseOrder.status === "Received" || purchaseOrder.status === "Closed") {
          acc.received += purchaseOrder.total;
        }
        return acc;
      },
      { committed: 0, open: 0, received: 0 },
    );
  }, [purchaseOrders]);

  function handleCreate(values: UpsertPurchaseOrderValues): void {
    createPurchaseOrder.mutate(
      { projectId: project.id, ...toInput(values) },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <section aria-label="Purchase orders">
      <TabActions>
        {canManage ? (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New purchase order
          </Button>
        ) : null}
      </TabActions>

      <UpsertPurchaseOrderDialog
        projectId={project.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createPurchaseOrder.isPending}
        error={(createPurchaseOrder.error as Error | undefined)?.message ?? null}
        currency={currency}
      />

      <section aria-label="Purchase order summary" className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Committed spend" value={formatCurrency(summary.committed, currency)} />
        <KpiCard label="Open POs" value={formatCurrency(summary.open, currency)} />
        <KpiCard label="Received / closed" value={formatCurrency(summary.received, currency)} />
      </section>

      <section className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <EmptyState
            icon={<FinancesIcon />}
            title="No purchase orders yet"
            description="Create vendor POs with line items to track committed spend before invoices arrive."
            action={
              canManage
                ? { label: "New purchase order", onClick: () => setCreateOpen(true), icon: <PlusIcon /> }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-4">
            {purchaseOrders.map((purchaseOrder) => (
              <PurchaseOrderCard
                key={purchaseOrder.id}
                purchaseOrder={purchaseOrder}
                projectId={project.id}
                currency={currency}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

PurchaseOrdersTab.displayName = "PurchaseOrdersTab";
