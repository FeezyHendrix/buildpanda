import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { UpsertDailyLogDialog } from "@/components/molecules/upsert-daily-log-dialog";
import { AddDailyLogEntryDialog } from "@/components/molecules/add-daily-log-entry-dialog";
import { VoidDailyLogEntryDialog } from "@/components/molecules/void-daily-log-entry-dialog";
import { useProjectContext } from "@/layouts/project-layout";
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
import type { DailyLogDay, DailyLogEntry, WeatherCondition } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const WEATHER_TONE: Record<WeatherCondition, "info" | "warning" | "danger" | "neutral"> = {
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
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ProjectDailyLog() {
  const { project, access } = useProjectContext();
  const { data: session } = useSession();
  const canManage = access?.capabilities?.canManage ?? false;
  const userId = session?.user?.id ?? null;

  const { data: days = [], isPending } = useProjectDailyDays(project.id);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [headerDate, setHeaderDate] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(null);

  const upsert = useUpsertDailyLog();
  const addEntry = useAddDailyLogEntry();
  const headerDay = useProjectDailyLog(headerDate ? project.id : undefined, headerDate ?? undefined);

  const today = todayIso();

  function openHeader(date: string): void {
    setHeaderDate(date);
    setHeaderOpen(true);
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Daily Log"
        description="Everyone on the team logs what they did each day. The report covers the whole day."
        actions={
          <Button variant="primary" size="md" onClick={() => setEntryDate(today)}>
            <PlusIcon className="size-4" />
            Add my log
          </Button>
        }
      />

      <section
        aria-label="Project completion"
        className="mt-8 flex flex-col gap-2 rounded-[16px] border-none bg-[#F8F8F8] p-5"
      >
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-black-300">Overall project completion</p>
          <p className="text-[20px] font-semibold tabular-nums text-black-500">
            {Math.round(project.progressPercent)}%
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E9EDFB]">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.max(0, Math.min(100, project.progressPercent))}%` }}
          />
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-4">
        {isPending ? (
          <Card padding="lg" className="rounded-[16px] border-none bg-[#F8F8F8] text-center text-sm text-black-300">
            Loading daily logs…
          </Card>
        ) : days.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="size-8 text-gray-300" />}
            title="No daily logs yet"
            description="Add your first log to start the project diary. Anyone on the team can contribute."
            action={
              <Button variant="primary" size="md" onClick={() => setEntryDate(today)}>
                <PlusIcon className="size-4" />
                Add my log
              </Button>
            }
          />
        ) : (
          days.map((day) => (
            <DayCard
              key={day.logDate}
              projectId={project.id}
              day={day}
              userId={userId}
              canManage={canManage}
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
        onOpenChange={(next) => { if (!next) setEntryDate(null); }}
        logDate={entryDate ?? today}
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
  canManage,
  onAddEntry,
  onEditHeader,
}: {
  projectId: string;
  day: DailyLogDay;
  userId: string | null;
  canManage: boolean;
  onAddEntry: () => void;
  onEditHeader: () => void;
}) {
  const downloadReport = useDownloadDailyReport();
  const emailReport = useEmailDailyReport();
  const dateLabel = new Date(`${day.logDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Card padding="lg" className="rounded-[16px] border-none bg-[#F8F8F8] p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEDED] px-6 py-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="size-4 text-black-300" />
          <p className="text-[15px] font-semibold text-black-500">{dateLabel}</p>
          {day.weatherCondition && (
            <Badge tone={WEATHER_TONE[day.weatherCondition]} size="sm">
              {day.weatherCondition}
            </Badge>
          )}
          <span className="text-[12px] text-black-300">
            Crew {day.workersPresent}/{day.workersExpected} · {day.totalHours}h
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs text-black-300 hover:text-black-500"
              onClick={onEditHeader}
            >
              Conditions
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-black-300 hover:text-black-500"
            disabled={downloadReport.isPending}
            onClick={() =>
              downloadReport.mutate(
                { projectId, logDate: day.logDate },
                { onError: () => toast("Could not download report") },
              )
            }
          >
            {downloadReport.isPending ? "Preparing…" : "Download report"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-black-300 hover:text-black-500"
            disabled={emailReport.isPending}
            onClick={() =>
              emailReport.mutate(
                { projectId, logDate: day.logDate },
                {
                  onSuccess: (res) => toast(`Report sent to ${res.sentTo}`, "success"),
                  onError: () => toast("Could not email report"),
                },
              )
            }
          >
            {emailReport.isPending ? "Sending…" : "Email me"}
          </Button>
          <Button variant="primary" size="sm" className="h-8 px-3 text-xs" onClick={onAddEntry}>
            <PlusIcon className="size-3.5" />
            Add log
          </Button>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-[#EDEDED]">
        {day.entries.length === 0 ? (
          <p className="px-6 py-6 text-center text-[13px] text-black-300">
            No team logs for this day yet.
          </p>
        ) : (
          day.entries.map((entry) => (
            <EntryRow
              key={entry.id}
              projectId={projectId}
              logDate={day.logDate}
              entry={entry}
              userId={userId}
              canManage={canManage}
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
  canManage,
}: {
  projectId: string;
  logDate: string;
  entry: DailyLogEntry;
  userId: string | null;
  canManage: boolean;
}) {
  const [voidOpen, setVoidOpen] = useState(false);
  const voidEntry = useVoidDailyLogEntry();
  const canVoid = !entry.voided && (entry.authorId === userId || canManage);
  const lastVoid = entry.voids.length > 0 ? entry.voids[entry.voids.length - 1]! : null;

  return (
    <div className={cn("px-6 py-4", entry.voided && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-[14px] font-semibold text-black-500",
              entry.voided && "line-through text-black-300",
            )}
          >
            {entry.authorName}
          </p>
          <Badge tone="neutral" size="sm">
            {entry.authorRole}
          </Badge>
          {entry.voided && (
            <Badge tone="danger" size="sm">
              Voided
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-black-200">Added {formatTime(entry.createdAt)}</span>
          {canVoid && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
              onClick={() => setVoidOpen(true)}
            >
              Void
            </Button>
          )}
        </div>
      </div>

      {entry.bodyHtml && entry.bodyHtml.trim().length > 0 && (
        <div
          className="prose prose-sm mt-2 max-w-none text-[13px] text-black-400 [&_img]:max-h-56 [&_img]:rounded-lg [&_p]:my-1"
          dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
        />
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
