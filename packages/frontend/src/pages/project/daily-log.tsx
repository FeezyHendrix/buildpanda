import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { SearchInput } from "@/components/atoms/search-input";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { DateRangeFilter, formatDateRangeLabel } from "@/components/molecules/date-range-filter";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { DailyReportDialog } from "@/components/molecules/daily-report-dialog";
import { UpsertDailyLogDialog } from "@/components/molecules/upsert-daily-log-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useSession } from "@/stores/auth";
import {
  useDownloadDailyReport,
  useEmailDailyReport,
  useProjectDailyLog,
  useProjectDailyLogs,
  useUpsertDailyLog,
} from "@/hooks/use-daily-logs";
import { canResourceAction } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { DailyLogDrawer } from "./daily-log/daily-log-drawer";
import { DailyLogTable, type DailyLogRowActions } from "./daily-log/daily-log-table";
import {
  buildRows,
  computeKpis,
  defaultDateRange,
  filterRows,
  formatHours,
  isIsoDate,
  ROW_FILTERS,
  todayIso,
  type RowFilter,
} from "./daily-log/daily-log-helpers";

const DATE_PARAM = "date";

interface DrawerState {
  logDate: string;
  focusComposer: boolean;
}

export default function ProjectDailyLog() {
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const { data: session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreateEntry = Boolean(access && canResourceAction(access, "dailyLog", "create"));
  const canVoidEntry = Boolean(access && canResourceAction(access, "dailyLog", "void"));
  const canGenerateReport = Boolean(access && canResourceAction(access, "dailyLog", "report"));
  const userId = session?.user?.id ?? null;
  const today = todayIso();

  const [range, setRange] = useState(defaultDateRange);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RowFilter>("all");
  const [drawer, setDrawer] = useState<DrawerState | null>(() => {
    const requested = searchParams.get(DATE_PARAM);
    return isIsoDate(requested) ? { logDate: requested, focusComposer: false } : null;
  });
  const [conditionsDate, setConditionsDate] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const listRange = useMemo(
    () => ({ from: range.from || undefined, to: range.to || undefined }),
    [range.from, range.to],
  );
  const { data: days = [], isPending } = useProjectDailyLogs(project.id, listRange, selectedBuildingId);
  const conditionsDay = useProjectDailyLog(conditionsDate ? project.id : undefined, conditionsDate ?? undefined);
  const upsert = useUpsertDailyLog();
  const downloadReport = useDownloadDailyReport();
  const emailReport = useEmailDailyReport();

  const allRows = useMemo(() => buildRows(days, today, range.to), [days, today, range.to]);
  const rows = useMemo(() => filterRows(allRows, filter, query), [allRows, filter, query]);
  const kpis = useMemo(() => computeKpis(allRows), [allRows]);
  const dateRangeLabel = formatDateRangeLabel(range.from, range.to, []);

  function syncDateParam(logDate: string | null): void {
    const next = new URLSearchParams(searchParams);
    if (logDate) next.set(DATE_PARAM, logDate);
    else next.delete(DATE_PARAM);
    setSearchParams(next, { replace: true });
  }

  function openDrawer(logDate: string, focusComposer = false): void {
    setDrawer({ logDate, focusComposer });
    syncDateParam(logDate);
  }

  function closeDrawer(): void {
    setDrawer(null);
    syncDateParam(null);
  }

  const rowActions: DailyLogRowActions = {
    onView: (logDate) => openDrawer(logDate),
    onConditions: setConditionsDate,
    onAddLog: (logDate) => openDrawer(logDate || today, true),
    onDownload: (logDate) =>
      downloadReport.mutate({ projectId: project.id, logDate }, { onError: () => toast("Could not download report") }),
    onEmail: (logDate) =>
      emailReport.mutate(
        { projectId: project.id, logDate },
        {
          onSuccess: (res) => toast(`Report sent to ${res.sentTo}`, "success"),
          onError: () => toast("Could not email report"),
        },
      ),
  };

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Daily log"
        actions={
          canCreateEntry || canGenerateReport ? (
            <div className="flex items-center gap-2">
              {canGenerateReport ? (
                <Button variant="secondary" size="md" onClick={() => setReportOpen(true)}>
                  Download report
                </Button>
              ) : null}
              {canCreateEntry ? (
                <Button variant="primary" size="md" onClick={() => openDrawer(today, true)}>
                  <PlusIcon className="size-4" />
                  Add my log
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      <section className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Days logged" value={kpis.daysLogged} />
        <KpiCard label="Missed days" value={kpis.missedDays} tone={kpis.missedDays > 0 ? "danger" : "default"} />
        <KpiCard label="Total hours" value={formatHours(kpis.totalHours)} />
        <KpiCard label="Average crew" value={kpis.averageCrew ?? "—"} helper="workers present per logged day" />
      </section>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 rounded-lg border border-[#EDEDED] bg-white lg:max-w-md">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by author or entry"
            aria-label="Search daily logs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs items={ROW_FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter daily logs" />
          <DateRangeFilter
            from={range.from}
            to={range.to}
            label={dateRangeLabel}
            onApply={(from, to) => setRange({ from, to })}
            onClear={() => setRange({ from: "", to: "" })}
          />
        </div>
      </div>

      <DailyLogTable
        rows={rows}
        isPending={isPending}
        hasAnyDays={days.length > 0}
        canCreateEntry={canCreateEntry}
        canGenerateReport={canGenerateReport}
        actions={rowActions}
      />

      <DailyLogDrawer
        open={drawer !== null}
        projectId={project.id}
        logDate={drawer?.logDate ?? null}
        focusComposer={drawer?.focusComposer ?? false}
        userId={userId}
        canCreateEntry={canCreateEntry}
        canVoidEntry={canVoidEntry}
        canGenerateReport={canGenerateReport}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
        onEditConditions={setConditionsDate}
      />

      <UpsertDailyLogDialog
        open={conditionsDate !== null}
        onOpenChange={(next) => {
          if (!next) setConditionsDate(null);
        }}
        initial={conditionsDate ? (conditionsDay.data ?? null) : null}
        defaultDate={conditionsDate ?? today}
        projectId={project.id}
        isSubmitting={upsert.isPending}
        error={upsert.error ? (upsert.error as Error).message : null}
        onSubmit={(values) =>
          upsert.mutate(
            { projectId: project.id, ...values },
            { onSuccess: () => setConditionsDate(null) },
          )
        }
      />

      {canGenerateReport ? (
        <DailyReportDialog open={reportOpen} onOpenChange={setReportOpen} projectId={project.id} />
      ) : null}
    </div>
  );
}
