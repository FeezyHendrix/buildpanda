import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { VoidMaterialEntryDialog } from "@/components/molecules/void-material-entry-dialog";
import { ReorderPolicyDialog } from "@/components/molecules/reorder-policy-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useMaterialStock,
  useMaterialLedger,
  useMaterialCatalog,
  useLogMaterialEntry,
  useVoidMaterialEntry,
  useDownloadMaterialReport,
  useEmailMaterialReport,
  useUpdateReorderPolicy,
} from "@/hooks/use-materials-ledger";
import { useMaterialOrders } from "@/hooks/use-materials-equipment";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { LedgerRow } from "./material-log/ledger-row";
import { LogMaterialDrawer } from "./material-log/log-material-drawer";
import { StockCard } from "./material-log/stock-card";


export default function ProjectMaterialLog() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "materials", "manage");
  const { data: stock = [], isLoading: stockLoading } = useMaterialStock(project.id);
  const { data: entries = [], isLoading: ledgerLoading } = useMaterialLedger(project.id);
  const { data: catalog = [] } = useMaterialCatalog(project.id);
  const { data: orders = [] } = useMaterialOrders(project.id);
  const logEntry = useLogMaterialEntry(project.id);
  const voidEntry = useVoidMaterialEntry(project.id);
  const downloadReport = useDownloadMaterialReport(project.id);
  const emailReport = useEmailMaterialReport(project.id);
  const updatePolicy = useUpdateReorderPolicy(project.id);

  const [logOpen, setLogOpen] = useState(false);
  const [voiding, setVoiding] = useState<LedgerEntry | null>(null);
  const [policyMaterialId, setPolicyMaterialId] = useState<string | null>(null);
  const policyMaterial = catalog.find((c) => c.id === policyMaterialId) ?? null;

  const materialOptions = useMemo(() => {
    const byName = new Map<string, { name: string; unit: string }>();
    const add = (name: string, unit: string) => {
      const key = name.trim().toLowerCase().replace(/\s+/g, " ");
      if (key && !byName.has(key)) byName.set(key, { name: name.trim(), unit });
    };
    for (const c of catalog) add(c.name, c.unit);
    for (const o of orders) add(o.materialName, o.unit);
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, orders]);

  const totals = useMemo(() => {
    let received = 0;
    let used = 0;
    for (const e of entries) {
      if (e.status === "Voided") continue;
      if (e.entryType === "IN") received += e.quantity;
      else if (e.entryType === "USED") used += e.quantity;
    }
    const onHand = stock.reduce((sum, s) => sum + s.onHandQty, 0);
    return { received, used, onHand };
  }, [entries, stock]);

  if (stockLoading || ledgerLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:max-w-none">
      <Breadcrumbs
        items={[
          { label: "Materials", to: `/project/${project.id}/materials` },
          { label: "Material Log" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Material Log"
        description="An audit trail of materials received and used on site, with live stock."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-xs text-gray-600 hover:text-gray-900"
              loading={downloadReport.isPending}
              onClick={() =>
                downloadReport.mutate(undefined, {
                  onError: () => toast("Could not download report"),
                })
              }
            >
              Download report
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-xs text-gray-600 hover:text-gray-900"
              loading={emailReport.isPending}
              onClick={() =>
                emailReport.mutate(undefined, {
                  onSuccess: (res) => toast(`Report sent to ${res.sentTo}`, "success"),
                  onError: () => toast("Could not email report"),
                })
              }
            >
              Email me
            </Button>
            {canManage && (
              <Button variant="primary" size="md" onClick={() => setLogOpen(true)}>
                <PlusIcon className="size-4" />
                Log material
              </Button>
            )}
          </div>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card padding="md" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Total stocked received</span>
          <span className="text-2xl font-semibold tabular-nums text-gray-900">
            {totals.received.toLocaleString()}
          </span>
        </Card>
        <Card padding="md" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Total used</span>
          <span className="text-2xl font-semibold tabular-nums text-gray-900">
            {totals.used.toLocaleString()}
          </span>
        </Card>
        <Card
          padding="md"
          className="flex flex-col gap-1 bg-[#004DE7] text-white shadow-md shadow-blue-900/10"
        >
          <span className="text-xs font-medium text-white/80">Stock in hand</span>
          <span
            className={cn(
              "text-3xl font-bold tabular-nums",
              totals.onHand < 0 ? "text-red-200" : "text-white",
            )}
          >
            {totals.onHand.toLocaleString()}
          </span>
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Stock by material</h2>
        {stock.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">No materials logged yet.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stock.map((s) => (
              <StockCard
                key={`${s.materialId}-${s.locationKey}`}
                stock={s}
                canManage={canManage}
                onEditPolicy={() => setPolicyMaterialId(s.materialId)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Activity</h2>
        {entries.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">No entries yet.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <LedgerRow
                key={e.id}
                entry={e}
                canManage={canManage}
                onVoid={() => setVoiding(e)}
              />
            ))}
          </div>
        )}
      </section>

      <LogMaterialDrawer
        open={logOpen}
        onOpenChange={setLogOpen}
        materials={materialOptions}
        submitting={logEntry.isPending}
        onSubmit={(input) =>
          logEntry.mutate(input, {
            onSuccess: (res) => {
              setLogOpen(false);
              if (res.negativeStock) {
                toast(`Logged. Heads up: ${input.materialName} is now at ${res.onHandQty}.`, "error");
              } else {
                toast("Material logged", "success");
              }
            },
            onError: () => toast("Could not log material"),
          })
        }
      />

      <VoidMaterialEntryDialog
        open={!!voiding}
        onOpenChange={(open) => { if (!open) setVoiding(null); }}
        entryLabel={
          voiding
            ? `This reverses ${voiding.entryType} of ${voiding.quantity} ${voiding.unit} ${voiding.materialName}.`
            : ""
        }
        submitting={voidEntry.isPending}
        error={voidEntry.isError ? "Could not void entry" : null}
        onConfirm={(reason) => {
          if (voiding) {
            voidEntry.mutate(
              { entryId: voiding.id, reason },
              {
                onSuccess: () => {
                  setVoiding(null);
                  toast("Entry voided", "success");
                },
                onError: () => toast("Could not void entry"),
              },
            );
          }
        }}
      />

      <ReorderPolicyDialog
        open={policyMaterialId !== null}
        onOpenChange={(open) => { if (!open) setPolicyMaterialId(null); }}
        projectId={project.id}
        material={policyMaterial}
        isSubmitting={updatePolicy.isPending}
        error={updatePolicy.error ? (updatePolicy.error as Error).message : null}
        onSubmit={(values) => {
          if (!policyMaterialId) return;
          updatePolicy.mutate(
            { materialId: policyMaterialId, ...values },
            {
              onSuccess: () => {
                setPolicyMaterialId(null);
                toast("Reorder policy saved", "success");
              },
              onError: () => toast("Could not save reorder policy"),
            },
          );
        }}
      />
    </div>
  );
}
