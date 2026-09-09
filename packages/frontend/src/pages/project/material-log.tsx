import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { VoidMaterialEntryDialog } from "@/components/molecules/void-material-entry-dialog";
import { ReorderPolicyDialog } from "@/components/molecules/reorder-policy-dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useApproveMaterialEntry,
  useMaterialStock,
  useMaterialLedger,
  useMaterialCatalog,
  useLogMaterialEntry,
  useVoidMaterialEntry,
  useDownloadMaterialReport,
  useEmailMaterialReport,
  useUpdateReorderPolicy,
} from "@/hooks/use-materials-ledger";
import { useStages } from "@/hooks/use-stages";
import { useMaterialOrders } from "@/hooks/use-materials-equipment";
import { toast } from "@/lib/toast";
import type { LedgerEntry } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { MetricCard } from "./materials/metric-card";
import { StackIcon } from "./material-log/icons";
import { LedgerList } from "./material-log/ledger-list";
import { LogMaterialDrawer } from "./material-log/log-material-drawer";
import { StockCard } from "./material-log/stock-card";
import { sortStockByUrgency } from "./material-log/shared";

export default function ProjectMaterialLog() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "materials", "manage");
  const { data: stock = [], isLoading: stockLoading } = useMaterialStock(project.id);
  const { data: entries = [], isLoading: ledgerLoading } = useMaterialLedger(project.id);
  const { data: catalog = [] } = useMaterialCatalog(project.id);
  const { data: stages = [] } = useStages(project.id);
  const approveEntry = useApproveMaterialEntry(project.id);
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

  const sortedStock = useMemo(() => sortStockByUrgency(stock), [stock]);
  const negativeCount = stock.filter((s) => s.onHandQty < 0).length;
  const lowCount = stock.filter((s) => s.lowStock && s.onHandQty >= 0).length;
  const voidedCount = entries.filter((e) => e.status === "Voided").length;
  const pendingCount = entries.filter(
    (e) => e.approvalStatus === "Pending" && e.status !== "Voided",
  ).length;

  if (stockLoading || ledgerLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Materials", to: `/project/${project.id}/materials` },
          { label: "Material log" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Material log"
        description="An append-only record of everything received and used on site, with live stock levels behind it."
        actions={
          <div className="flex flex-wrap items-center gap-2 [&>button]:whitespace-nowrap">
            <Button
              type="button"
              variant="secondary"
              size="md"
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
              variant="secondary"
              size="md"
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

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Materials tracked"
          value={stock.length.toString()}
          helper="Carrying a stock balance"
        />
        <MetricCard
          label="Needs attention"
            value={(negativeCount + lowCount + pendingCount).toString()}
            helper={
              pendingCount > 0
                ? `${pendingCount} awaiting approval`
                : negativeCount > 0
                  ? `${negativeCount} at negative stock`
                  : lowCount > 0
                    ? `${lowCount} below reorder level`
                    : "All levels healthy"
            }
        />
        <MetricCard
          label="Ledger entries"
          value={entries.length.toString()}
          helper={voidedCount > 0 ? `${voidedCount} voided` : "None voided"}
        />
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-black-500">
            Stock by material
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Received minus used. Anything negative or below its reorder level is
            flagged and listed first.
          </p>
        </div>
        {sortedStock.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<StackIcon className="size-8 text-gray-300" />}
              title="No stock yet"
              description="Log the first delivery and this project's running stock levels will build up here."
              action={
                canManage ? (
                  <Button variant="primary" size="md" onClick={() => setLogOpen(true)}>
                    <PlusIcon className="size-4" />
                    Log material
                  </Button>
                ) : undefined
              }
              className="px-6 py-12"
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {sortedStock.map((s) => (
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
        <LedgerList
          entries={entries}
          canManage={canManage}
          onVoid={setVoiding}
          onApprove={(entry) =>
            approveEntry.mutate(entry.id, {
              onSuccess: () => toast("Approved — it now counts toward stock", "success"),
              onError: () => toast("Could not approve that entry"),
            })
          }
          approvingId={approveEntry.isPending ? approveEntry.variables : null}
        />
      </section>

      <LogMaterialDrawer
        open={logOpen}
        onOpenChange={setLogOpen}
          materials={materialOptions}
          stages={stages}
          submitting={logEntry.isPending}
        onSubmit={(input) =>
          logEntry.mutate(input, {
            onSuccess: () => {
              setLogOpen(false);
              // Every fresh log is born pending under the gate, so it does not
              // move stock yet — and the negative-stock heads-up cannot fire on
              // a movement that was not applied. That warning now belongs to
              // approval, where the delta is actually applied.
              toast("Logged — awaiting approval before it counts toward stock", "success");
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
