import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { Spinner } from "@/components/atoms/spinner";
import { VoidMaterialEntryDialog } from "@/components/molecules/void-material-entry-dialog";
import { ReorderPolicyDialog } from "@/components/molecules/reorder-policy-dialog";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
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
import { MetricCard, MetricFigure } from "@/components/molecules/metric-card";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { errorMessage } from "@/lib/api-error";
import { Download } from "lucide-react";
import { ActivityToolbar } from "./material-log/activity-toolbar";
import { StockByMaterial } from "./material-log/stock-by-material";
import { LedgerTable } from "./material-log/ledger-table";
import { LogMaterialDrawer } from "./material-log/log-material-drawer";
import {
  formatQty,
  matchesLedgerDate,
  matchesLedgerFilter,
  matchesLedgerSearch,
  sortStockByUrgency,
  type LedgerFilter,
} from "./material-log/shared";

const PAGE_SIZE = 10;

export default function ProjectMaterialLog() {
  useSetPageTitle("Material Log", "Stock received, used and on hand, with every movement logged.");
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
  const [search, setSearch] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
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
  // Plain sums across every material: they read as volumes, not as one unit.
  const totalReceived = stock.reduce((sum, s) => sum + s.totalReceived, 0);
  const totalUsed = stock.reduce((sum, s) => sum + s.totalUsed, 0);
  const totalOnHand = stock.reduce((sum, s) => sum + s.onHandQty, 0);

  const visibleEntries = entries
    .filter((entry) => matchesLedgerFilter(entry, ledgerFilter))
    .filter((entry) => matchesLedgerDate(entry, dateFrom, dateTo))
    .filter((entry) => matchesLedgerSearch(entry, search));
  const ledgerFiltered = ledgerFilter !== "all" || (dateFrom !== "" || dateTo !== "") || search.trim() !== "";
  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = visibleEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /** A narrower or wider result set starts again from its first page. */
  function filtered<T>(setter: (value: T) => void): (value: T) => void {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  function clearLedgerFilters(): void {
    setLedgerFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setPage(1);
  }

  if (stockLoading || ledgerLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-8 pt-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-end gap-2 [&>button]:whitespace-nowrap">
        <Button
          type="button"
          variant="outline"
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
        <Button
          type="button"
          variant="outline"
          size="md"
          loading={downloadReport.isPending}
          onClick={() =>
            downloadReport.mutate(undefined, {
              onError: () => toast("Could not download report"),
            })
          }
        >
          <Download className="size-4" />
          Download Report
        </Button>
        {canManage ? <CreateButton onClick={() => setLogOpen(true)}>Log material</CreateButton> : null}
      </div>

      <section aria-label="Material totals" className="mt-6 grid gap-6 sm:grid-cols-3">
        <MetricCard label="Total stocked received" value={<MetricFigure className="font-semibold">{formatQty(totalReceived)}</MetricFigure>} />
        <MetricCard label="Total used" value={<MetricFigure className="font-semibold">{formatQty(totalUsed)}</MetricFigure>} />
        <MetricCard label="Stock in hand" value={<MetricFigure className="font-semibold">{formatQty(totalOnHand)}</MetricFigure>} />
      </section>

      <StockByMaterial
        stock={sortedStock}
        canManage={canManage}
        onLogMaterial={() => setLogOpen(true)}
        onEditPolicy={setPolicyMaterialId}
      />

      <section aria-labelledby="activity-heading" className="mt-10">
        <h2 id="activity-heading" className="text-xl font-semibold text-black-500">
          Activity
        </h2>

        <ActivityToolbar
          search={search}
          onSearchChange={filtered(setSearch)}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setPage(1);
          }}
          status={ledgerFilter}
          onStatusChange={filtered(setLedgerFilter)}
        />

        <LedgerTable
          entries={pageEntries}
          isFiltered={ledgerFiltered}
          isLoading={ledgerLoading}
          canManage={canManage}
          approvingId={approveEntry.isPending ? approveEntry.variables : null}
          onVoid={setVoiding}
          onApprove={(entry) =>
            approveEntry.mutate(entry.id, {
              onSuccess: () => toast("Approved — it now counts toward stock", "success"),
              onError: () => toast("Could not approve that entry"),
            })
          }
          onClearFilters={clearLedgerFilters}
        />

        {visibleEntries.length > 0 ? (
          <NumberedPagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={visibleEntries.length}
            noun="Activities"
            onPageChange={setPage}
          />
        ) : null}
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
        error={updatePolicy.error ? errorMessage(updatePolicy.error) : null}
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
