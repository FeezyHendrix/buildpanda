import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { resolveFileUrl } from "@/hooks/use-files";
import {
  ChevronDown,
  ChevronUp,
  Download,
  MoreVertical,
  Pencil,
  Plus,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/atoms/dropdown-menu";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { Select } from "@/components/atoms/select";
import { UpsertDailyLogDialog } from "@/components/molecules/upsert-daily-log-dialog";
import { AddDailyLogEntryDialog } from "@/components/molecules/add-daily-log-entry-dialog";
import { VoidDailyLogEntryDialog } from "@/components/molecules/void-daily-log-entry-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useSession } from "@/stores/auth";
import {
  useProjectDailyDays,
  useProjectDailyLog,
  useUpsertDailyLog,
  useAddDailyLogEntry,
  useVoidDailyLogEntry,
  useDownloadDailyReport,
  useDownloadPeriodReport,
} from "@/hooks/use-daily-logs";
import {
  REPORT_PERIOD_OPTIONS,
  canResourceAction,
  type DailyLogDay,
  type DailyLogEntry,
  type ReportPeriod,
} from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import emptyIcon from "@/assets/images/empty-dashboard.svg";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function parseHtml(html: string): HTMLDivElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

function extractFileIds(html: string): string[] {
  return Array.from(
    parseHtml(html).querySelectorAll<HTMLImageElement>("img[data-file-id]"),
  )
    .map((img) => img.getAttribute("data-file-id")!)
    .filter(Boolean);
}

function extractDirectSrcs(html: string): string[] {
  return Array.from(
    parseHtml(html).querySelectorAll<HTMLImageElement>(
      "img[src]:not([data-file-id])",
    ),
  )
    .map((img) => img.src)
    .filter(Boolean);
}

function stripImages(html: string): string {
  const div = parseHtml(html);
  div.querySelectorAll("img").forEach((img) => img.remove());
  return div.innerHTML;
}

export default function ProjectDailyLog() {
  useSetPageTitle(
    "Daily Log",
    "Everyone on the team logs what they did each day. The report covers the whole day.",
  );

  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const { data: session } = useSession();
  const canCreateEntry = Boolean(
    access && canResourceAction(access, "dailyLog", "create"),
  );
  const canVoidEntry = Boolean(
    access && canResourceAction(access, "dailyLog", "void"),
  );
  const canGenerateReport = Boolean(
    access && canResourceAction(access, "dailyLog", "report"),
  );
  const userId = session?.user?.id ?? null;
  const userProfession =
    (session?.user as { profession?: string } | undefined)?.profession ?? null;

  const { data: days = [], isPending } = useProjectDailyDays(
    project.id,
    undefined,
    selectedBuildingId,
  );
  const [headerOpen, setHeaderOpen] = useState(false);
  const [headerDate, setHeaderDate] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("weekly");
  const [reportDate, setReportDate] = useState<string>("");
  const reportPanelRef = useRef<HTMLDivElement>(null);

  const downloadPeriodReport = useDownloadPeriodReport();
  const upsert = useUpsertDailyLog();
  const addEntry = useAddDailyLogEntry();
  const headerDay = useProjectDailyLog(
    headerDate ? project.id : undefined,
    headerDate ?? undefined,
  );

  const today = todayIso();

  useEffect(() => {
    if (!reportPanelOpen) return;
    function handleClick(e: MouseEvent) {
      if (!reportPanelRef.current?.contains(e.target as Node)) {
        setReportPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [reportPanelOpen]);

  function openHeader(date: string): void {
    setHeaderDate(date);
    setHeaderOpen(true);
  }

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <>
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={<img src={emptyIcon} alt="" className="size-90" />}
            title="No logs have been added yet"
            action={
              canCreateEntry ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setEntryDate(today)}
                >
                  <Plus className="size-5" />
                  Create a log
                </Button>
              ) : undefined
            }
          />
        </div>
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
      </>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[738px] px-6 py-5">
        {/* Action bar */}
        <div className="mb-6 flex items-center justify-end gap-3">
          {canGenerateReport && (
            <div className="relative" ref={reportPanelRef}>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setReportPanelOpen((v) => !v)}
                className="flex items-center justify-between gap-6"
              >
                <div className="flex items-center gap-2">
                  <Download className="size-[15px] text-black-500" />
                  Download Report
                </div>

                {reportPanelOpen ? (
                  <ChevronUp className="size-[15px] text-black-500" />
                ) : (
                  <ChevronDown className="size-[15px] text-black-500" />
                )}
              </Button>

              {reportPanelOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 flex w-[303px] flex-col gap-4 border border-[#DDDDDD] bg-white p-4 shadow-lg">
                  <div className="flex flex-col gap-2">
                    <span className="text-caption-s font-bold uppercase tracking-[20%] text-grey-450">
                      Report Duration
                    </span>
                    <Select
                      options={REPORT_PERIOD_OPTIONS}
                      value={reportPeriod}
                      onChange={(v) => v && setReportPeriod(v as ReportPeriod)}
                      listClassName="!h-40"
                    />
                  </div>

                  <div className="h-px bg-[#EBEBEB]" />

                  <div className="flex flex-col gap-2">
                    <span className="text-caption-s font-bold uppercase tracking-[20%] text-grey-450">
                      Start Date
                    </span>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] outline-none focus:border-[#004DE7]"
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    disabled={downloadPeriodReport.isPending}
                    className="w-full justify-center"
                    onClick={() => {
                      downloadPeriodReport.mutate(
                        {
                          projectId: project.id,
                          period: reportPeriod,
                          date: reportDate || today,
                        },
                        {
                          onSuccess: () => setReportPanelOpen(false),
                          onError: () => toast("Could not download report"),
                        },
                      );
                    }}
                  >
                    <Download className="size-3.5" />
                    Download Report
                  </Button>
                </div>
              )}
            </div>
          )}
          {canCreateEntry && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setEntryDate(today)}
            >
              <Plus className="size-4" />
              Create new log
            </Button>
          )}
        </div>

        {/* Day sections */}
        <div className="flex flex-col gap-2">
          {days.map((day, i) => (
            <DaySection
              key={day.logDate}
              projectId={project.id}
              day={day}
              userId={userId}
              userProfession={userProfession}
              canVoidEntry={canVoidEntry}
              canGenerateReport={canGenerateReport}
              initialCollapsed={i !== 0}
              onEditHeader={() => openHeader(day.logDate)}
            />
          ))}
        </div>
      </div>

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

function DaySection({
  projectId,
  day,
  userId,
  userProfession,
  canVoidEntry,
  canGenerateReport,
  initialCollapsed = false,
  onEditHeader,
}: {
  projectId: string;
  day: DailyLogDay;
  userId: string | null;
  userProfession: string | null;
  canVoidEntry: boolean;
  canGenerateReport: boolean;
  initialCollapsed?: boolean;
  onEditHeader: () => void;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const downloadReport = useDownloadDailyReport();

  const dateLabel = new Date(`${day.logDate}T00:00:00`).toLocaleDateString(
    undefined,
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );

  return (
    <div className="border-[0.5px] border-border bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-[15px] font-semibold text-gray-900">
          {dateLabel}
        </span>
        <div className="flex items-center gap-4">
          {canGenerateReport && (
            <Button
              variant="ghost"
              className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:bg-transparent disabled:opacity-50"
              disabled={downloadReport.isPending}
              onClick={() =>
                downloadReport.mutate(
                  { projectId, logDate: day.logDate },
                  { onError: () => toast("Could not download report") },
                )
              }
            >
              <Download className="size-4 text-primary" />
              Download report
            </Button>
          )}
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <ChevronDown className="size-4 text-black-500" />
            ) : (
              <ChevronUp className="size-4 text-black-500" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div>
          {day.entries.length === 0 ? (
            <p className="px-6 pb-5 text-[13px] text-gray-400">
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
                userProfession={userProfession}
                canVoidEntry={canVoidEntry}
                onEditLog={onEditHeader}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  projectId,
  logDate,
  entry,
  userId,
  userProfession,
  canVoidEntry,
  onEditLog,
}: {
  projectId: string;
  logDate: string;
  entry: DailyLogEntry;
  userId: string | null;
  userProfession: string | null;
  canVoidEntry: boolean;
  onEditLog: () => void;
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

  const [mediaItems, setMediaItems] = useState<
    { id: string; url: string; type: "photo" }[]
  >([]);

  useEffect(() => {
    if (!entry.bodyHtml) {
      setMediaItems([]);
      return;
    }
    const direct = extractDirectSrcs(entry.bodyHtml).map((url, i) => ({
      id: `direct-${i}`,
      url,
      type: "photo" as const,
    }));
    const fileIds = extractFileIds(entry.bodyHtml);
    if (fileIds.length === 0) {
      setMediaItems(direct);
      return;
    }
    Promise.all(
      fileIds.map((id) =>
        resolveFileUrl(id).then((url) => ({ id, url, type: "photo" as const })),
      ),
    )
      .then((resolved) => setMediaItems([...direct, ...resolved]))
      .catch(() => setMediaItems(direct));
  }, [entry.bodyHtml]);

  const canVoid = !entry.voided && (entry.authorId === userId || canVoidEntry);
  const lastVoid =
    entry.voids.length > 0 ? entry.voids[entry.voids.length - 1]! : null;
  const hasBody = Boolean(entry.bodyHtml?.trim());
  const textHtml = hasBody ? stripImages(entry.bodyHtml!) : "";

  return (
    <div
      className={cn(
        "border-t border-border px-6 py-4",
        entry.voided && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {/* <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption-l font-semibold text-primary">
          {getInitials(entry.authorName)}
        </div> */}

        <div className="min-w-0 flex-1">
          {/* Name / role / time / kebab */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption-l font-semibold text-primary">
                {getInitials(entry.authorName)}
              </div>
              <div className="flex flex-col">
                <p
                  className={cn(
                    "text-caption-l font-semibold text-black-500",
                    entry.voided && "text-gray-400 line-through",
                  )}
                >
                  {entry.authorName}
                </p>
                <p className="text-caption-l font-normal text-grey-450 capitalize">
                  {entry.authorId === userId && userProfession
                    ? userProfession
                    : entry.authorRole}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-caption-m text-grey-450 italic">
                {formatRelative(entry.createdAt)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[148px] p-1">
                  <DropdownMenuItem
                    onSelect={onEditLog}
                    className="flex items-center gap-2.5 py-2 text-[13px]"
                  >
                    <Pencil className="size-3.5 text-gray-500" />
                    Edit Log
                  </DropdownMenuItem>
                  {canVoid && (
                    <DropdownMenuItem
                      tone="danger"
                      onSelect={() => setVoidOpen(true)}
                      className="flex items-center gap-2.5 py-2 text-[13px]"
                    >
                      <XCircle className="size-3.5" />
                      Void Log
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {entry.voided && (
            <Badge tone="danger" size="sm" className="mt-1.5">
              Voided
            </Badge>
          )}

          {/* Body text */}
          {textHtml && (
            <div className="mt-2">
              <div
                ref={contentRef}
                className={cn(
                  "prose prose-sm max-w-none text-caption-l leading-relaxed text-grey-500 [&_p]:my-0.5",
                  !expanded && "line-clamp-4",
                )}
                dangerouslySetInnerHTML={{ __html: textHtml }}
              />
              {(isClamped || expanded) && (
                <button
                  type="button"
                  className="mt-1 text-caption-l font-medium text-primary hover:underline"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {/* Image thumbnails */}
          {mediaItems.length > 0 && (
            <MediaGallery
              items={mediaItems}
              aspectRatio="4/3"
              itemClassName="rounded-none"
              className="mt-3"
            />
          )}

          {/* Void reason */}
          {entry.voided && lastVoid && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
              <p className="text-[12px] font-semibold text-red-700">
                Voided by {lastVoid.voidedByName}
              </p>
              <p className="text-[12px] text-red-900/80">{lastVoid.reason}</p>
            </div>
          )}
        </div>
      </div>

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
