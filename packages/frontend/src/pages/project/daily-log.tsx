import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { UpsertDailyLogDialog } from "@/components/molecules/upsert-daily-log-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useDeleteDailyLog,
  useProjectDailyLog,
  useProjectDailyLogs,
  useUpsertDailyLog,
} from "@/hooks/use-daily-logs";
import type { DailyLog, WeatherCondition } from "@/lib/project-types";

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

export default function ProjectDailyLog() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: logs = [], isPending } = useProjectDailyLogs(project.id);
  const [open, setOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const upsert = useUpsertDailyLog();
  const editingLog = useProjectDailyLog(
    editingDate ? project.id : undefined,
    editingDate ?? undefined,
  );

  const todayLog = useMemo(
    () => logs.find((log) => log.logDate === todayIso()) ?? null,
    [logs],
  );

  function openForToday(): void {
    setEditingDate(todayLog?.logDate ?? null);
    setOpen(true);
  }

  function openForDate(date: string): void {
    setEditingDate(date);
    setOpen(true);
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Daily Log"
        description="One end-of-day record per day: weather, headcount, hours worked, what got done."
        actions={canManage ? (
          <Button variant="primary" size="md" onClick={openForToday}>
            <PlusIcon className="size-4" />
            {todayLog ? "Update today's log" : "Log today"}
          </Button>
        ) : undefined}
      />

      <section className="mt-8 flex flex-col gap-3">
        {isPending ? (
          <Card padding="lg" className="text-center text-sm text-gray-500">
            Loading daily logs…
          </Card>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="size-8 text-gray-300" />}
            title="No daily logs yet"
            description="Capture today's end-of-day summary to start the project diary."
            action={canManage ? (
              <Button variant="primary" size="md" onClick={openForToday}>
                <PlusIcon className="size-4" />
                Log today
              </Button>
            ) : undefined}
          />
        ) : (
          logs.map((log) => (
            <LogRow
              key={log.logDate}
              projectId={project.id}
              log={log}
              onClick={() => openForDate(log.logDate)}
            />
          ))
        )}
      </section>

      <UpsertDailyLogDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditingDate(null);
        }}
        initial={editingDate ? (editingLog.data ?? null) : null}
        defaultDate={editingDate ?? todayIso()}
        isSubmitting={upsert.isPending}
        error={upsert.error ? (upsert.error as Error).message : null}
        onSubmit={(values) => {
          upsert.mutate(
            { projectId: project.id, ...values },
            {
              onSuccess: () => {
                setOpen(false);
                setEditingDate(null);
              },
            },
          );
        }}
      />
    </div>
  );
}

function LogRow({
  projectId,
  log,
  onClick,
}: {
  projectId: string;
  log: DailyLog;
  onClick: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteLog = useDeleteDailyLog();

  return (
    <>
      <Card
        padding="md"
        interactive
        onClick={onClick}
        className="flex flex-col gap-3"
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarIcon className="size-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">{log.logDate}</p>
            {log.weatherCondition && (
              <Badge tone={WEATHER_TONE[log.weatherCondition]} size="sm">
                {log.weatherCondition}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs tabular-nums text-gray-500">
            <span>
              Crew {log.workersPresent}/{log.workersExpected}
            </span>
            <span>{log.totalHours} h</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteOpen(true);
              }}
            >
              Delete
            </Button>
          </div>
        </header>
        {log.summary && (
          <p className="text-sm text-gray-600 text-pretty">{log.summary}</p>
        )}
        {log.activities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {log.activities.map((a) => (
              <Badge key={a.activityId} tone="neutral" size="sm">
                {a.activityName} · {a.hoursLogged}h
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteLog.mutate({ projectId, logDate: log.logDate })}
        title="Delete daily log"
        description={`This permanently removes the daily log for ${log.logDate}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
