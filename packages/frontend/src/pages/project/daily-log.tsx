import { useLayoutEffect, useRef, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { DailyReportDialog } from "@/components/molecules/daily-report-dialog";
import { UpsertDailyLogDialog } from "@/components/molecules/upsert-daily-log-dialog";
import { AddDailyLogEntryDialog } from "@/components/molecules/add-daily-log-entry-dialog";
import { VoidDailyLogEntryDialog } from "@/components/molecules/void-daily-log-entry-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useSession } from "@/stores/auth";
import {
  useProjectDailyDays,
  useProjectDailyLog,
  useUpsertDailyLog,
  useAddDailyLogEntry,
  useVoidDailyLogEntry,
  useDownloadDailyReport,
  useEmailDailyReport,
} from "@/hooks/use-daily-logs";
import {
  canResourceAction,
  type DailyLogDay,
  type DailyLogEntry,
  type WeatherCondition,
} from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const WEATHER_TONE: Record<
  WeatherCondition,
  "info" | "warning" | "danger" | "neutral"
> = {
  Sunny: "warning",
  Cloudy: "neutral",
  Rain: "info",
  Storm: "danger",
  Fog: "neutral",
  ExtremeHeat: "danger",
};

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProjectDailyLog() {
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const { data: session } = useSession();
  const canCreateEntry = Boolean(access && canResourceAction(access, "dailyLog", "create"));
  const canVoidEntry = Boolean(access && canResourceAction(access, "dailyLog", "void"));
  const userId = session?.user?.id ?? null;

  const { data: days = [], isPending } = useProjectDailyDays(project.id, undefined, selectedBuildingId);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [headerDate, setHeaderDate] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const canGenerateReport = Boolean(access && canResourceAction(access, "dailyLog", "report"));

  const upsert = useUpsertDailyLog();
  const addEntry = useAddDailyLogEntry();
  const headerDay = useProjectDailyLog(
    headerDate ? project.id : undefined,
    headerDate ?? undefined,
  );

  const today = todayIso();

  function openHeader(date: string): void {
    setHeaderDate(date);
    setHeaderOpen(true);
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Daily Log"
        actions={
          canCreateEntry || canGenerateReport ? (
            <div className="flex items-center gap-2">
              {canGenerateReport ? (
                <Button variant="secondary" size="md" onClick={() => setReportOpen(true)}>
                  Download report
                </Button>
              ) : null}
              {canCreateEntry ? (
                <Button variant="primary" size="md" onClick={() => setEntryDate(today)}>
                  <PlusIcon className="size-4" />
                  Add my log
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {canGenerateReport ? (
        <DailyReportDialog open={reportOpen} onOpenChange={setReportOpen} projectId={project.id} />
      ) : null}


      <section className="mt-8 flex flex-col gap-4">
        {isPending ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : days.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon />}
            title="No daily logs yet"
            description="Add your first log to start the project diary, which anyone on the team can contribute to."
            action={canCreateEntry ? { label: "Add my log", onClick: () => setEntryDate(today), icon: <PlusIcon /> } : undefined}
          />
        ) : (
          days.map((day) => (
            <DayCard
              key={day.logDate}
              projectId={project.id}
              day={day}
              userId={userId}
              canCreateEntry={canCreateEntry}
              canVoidEntry={canVoidEntry}
              canGenerateReport={canGenerateReport}
              onAddEntry={() => setEntryDate(day.logDate)}
              onEditHeader={() => openHeader(day.logDate)}
            />
          ))
        )}
      </section>

      <UpsertDailyLogDialog
        open={headerOpen}
        onOpenChange={(next) => {
          setHeaderOpen(next);
          if (!next) setHeaderDate(null);
        }}
        initial={headerDate ? (headerDay.data ?? null) : null}
        defaultDate={headerDate ?? today}
        projectId={project.id}
        isSubmitting={upsert.isPending}
        error={upsert.error ? (upsert.error as Error).message : null}
        onSubmit={(values) => {
          upsert.mutate(
            { projectId: project.id, ...values },
            {
              onSuccess: () => {
                setHeaderOpen(false);
                setHeaderDate(null);
              },
            },
          );
        }}
      />

      <AddDailyLogEntryDialog
        open={entryDate !== null}
        onOpenChange={(next) => {
          if (!next) setEntryDate(null);
        }}
        logDate={entryDate ?? today}
        projectId={project.id}
        submitting={addEntry.isPending}
        error={addEntry.error ? (addEntry.error as Error).message : null}
        onSubmit={(bodyHtml, bodyText) => {
          if (!entryDate) return;
          addEntry.mutate(
            { projectId: project.id, logDate: entryDate, bodyHtml, bodyText },
            {
              onSuccess: () => {
                setEntryDate(null);
                toast("Your log was added", "success");
              },
              onError: () => toast("Could not add your log"),
            },
          );
        }}
      />
    </div>
  );
}

function DayCard({
  projectId,
  day,
  userId,
  canCreateEntry,
  canVoidEntry,
  canGenerateReport,
  onAddEntry,
  onEditHeader,
}: {
  projectId: string;
  day: DailyLogDay;
  userId: string | null;
  canCreateEntry: boolean;
  canVoidEntry: boolean;
  canGenerateReport: boolean;
  onAddEntry: () => void;
  onEditHeader: () => void;
}) {
  const downloadReport = useDownloadDailyReport();
  const emailReport = useEmailDailyReport();
  const dateLabel = new Date(`${day.logDate}T00:00:00`).toLocaleDateString(
    undefined,
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );

  return (
    <Card padding="lg" className="rounded-[16px] border-none bg-[#F8F8F8] p-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-3 border-b border-[#EDEDED] px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <CalendarIcon className="size-4 text-black-300 hidden sm:block" />
          <p className="text-[15px] font-semibold text-black-500">
            {dateLabel}
          </p>
          {day.weatherCondition && (
            <Badge tone={WEATHER_TONE[day.weatherCondition]} size="sm">
              {day.weatherCondition}
            </Badge>
          )}
          <span className="text-[12px] text-black-300 w-full sm:w-auto">
            Crew {day.workersPresent}/{day.workersExpected} · {day.totalHours}h
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {canCreateEntry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEditHeader}
            >
              Conditions
            </Button>
          )}
          {canGenerateReport && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={downloadReport.isPending}
              onClick={() =>
                downloadReport.mutate(
                  { projectId, logDate: day.logDate },
                  { onError: () => toast("Could not download report") },
                )
              }
            >
              Download report
            </Button>
          )}
          {canGenerateReport && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={emailReport.isPending}
              onClick={() =>
                emailReport.mutate(
                  { projectId, logDate: day.logDate },
                  {
                    onSuccess: (res) =>
                      toast(`Report sent to ${res.sentTo}`, "success"),
                    onError: () => toast("Could not email report"),
                  },
                )
              }
            >
              Email me
            </Button>
          )}
          {canCreateEntry && (
            <Button
              variant="primary"
              size="sm"
              onClick={onAddEntry}
            >
              <PlusIcon className="size-3.5" />
              Add log
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col divide-y divide-[#EDEDED]">
        {day.entries.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No team logs for this day yet"
            description="Entries added by the team for this day will appear here."
          />
        ) : (
          day.entries.map((entry) => (
            <EntryRow
              key={entry.id}
              projectId={projectId}
              logDate={day.logDate}
              entry={entry}
              userId={userId}
              canVoidEntry={canVoidEntry}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function EntryRow({
  projectId,
  logDate,
  entry,
  userId,
  canVoidEntry,
}: {
  projectId: string;
  logDate: string;
  entry: DailyLogEntry;
  userId: string | null;
  canVoidEntry: boolean;
}) {
  const [voidOpen, setVoidOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const voidEntry = useVoidDailyLogEntry();

  useLayoutEffect(() => {
    if (expanded) return;
    const el = contentRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      setIsClamped(el.scrollHeight > el.clientHeight);
    });
    return () => cancelAnimationFrame(id);
  }, [entry.bodyHtml, expanded]);
  const canVoid = !entry.voided && (entry.authorId === userId || canVoidEntry);
  const lastVoid =
    entry.voids.length > 0 ? entry.voids[entry.voids.length - 1]! : null;

  const hasBody = entry.bodyHtml && entry.bodyHtml.trim().length > 0;

  return (
    <div className={cn("px-4 sm:px-6 py-4", entry.voided && "opacity-70")}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "text-[14px] font-semibold text-black-500",
              entry.voided && "line-through text-black-300",
            )}
          >
            {entry.authorName}
          </p>
          <Badge tone="neutral" size="sm" className='capitalize'>
            {entry.authorRole}
          </Badge>
          {entry.voided && (
            <Badge tone="danger" size="sm">
              Voided
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
          <span className="text-[11px] text-black-200">
            Added {formatTime(entry.createdAt)}
          </span>
          {canVoid && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 px-3 sm:h-7 sm:px-2 text-xs text-red-500 hover:text-red-600"
              onClick={() => setVoidOpen(true)}
            >
              Void
            </Button>
          )}
        </div>
      </div>

      {hasBody && (
        <div className="mt-2">
          <div
            ref={contentRef}
            className={cn(
              "prose prose-sm max-w-none text-[13px] text-black-400 [&_img]:max-h-56 [&_img]:rounded-lg [&_p]:my-1",
              !expanded && "line-clamp-4",
            )}
            dangerouslySetInnerHTML={{ __html: entry.bodyHtml! }}
          />
          {(isClamped || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 py-1.5 sm:py-0 text-[12px] font-medium text-primary hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {entry.voided && lastVoid && (
        <div className="mt-2 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
          <p className="text-[12px] font-semibold text-red-700">
            Voided by {lastVoid.voidedByName} · {formatTime(lastVoid.voidedAt)}
          </p>
          <p className="text-[12px] text-red-900/80">{lastVoid.reason}</p>
          {entry.voids.length > 1 && (
            <p className="mt-1 text-[11px] text-red-700/70">
              Voided {entry.voids.length} times — see report for full history.
            </p>
          )}
        </div>
      )}

      <VoidDailyLogEntryDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        authorName={entry.authorName}
        submitting={voidEntry.isPending}
        error={voidEntry.error ? (voidEntry.error as Error).message : null}
        onConfirm={(reason) =>
          voidEntry.mutate(
            { projectId, logDate, entryId: entry.id, reason },
            {
              onSuccess: () => {
                setVoidOpen(false);
                toast("Entry voided", "success");
              },
              onError: () => toast("Could not void entry"),
            },
          )
        }
      />
    </div>
  );
}
