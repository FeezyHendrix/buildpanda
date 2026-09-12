import { useLayoutEffect, useRef, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { VoidDailyLogEntryDialog } from "@/components/molecules/void-daily-log-entry-dialog";
import { useVoidDailyLogEntry } from "@/hooks/use-daily-logs";
import type { DailyLogEntry } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { formatTime } from "./daily-log-helpers";

interface DailyLogEntryRowProps {
  projectId: string;
  logDate: string;
  entry: DailyLogEntry;
  userId: string | null;
  canVoidEntry: boolean;
}

/** One team member's entry for the day: author, time, body, and the void trail. */
function DailyLogEntryRow({ projectId, logDate, entry, userId, canVoidEntry }: DailyLogEntryRowProps) {
  const [voidOpen, setVoidOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const voidEntry = useVoidDailyLogEntry();

  useLayoutEffect(() => {
    if (expanded) return;
    const el = contentRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => setIsClamped(el.scrollHeight > el.clientHeight));
    return () => cancelAnimationFrame(id);
  }, [entry.bodyHtml, expanded]);

  const canVoid = !entry.voided && (entry.authorId === userId || canVoidEntry);
  const lastVoid = entry.voids.length > 0 ? entry.voids[entry.voids.length - 1]! : null;
  const hasBody = Boolean(entry.bodyHtml && entry.bodyHtml.trim().length > 0);

  return (
    <div className={cn("py-4", entry.voided && "opacity-70")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-semibold text-black-500", entry.voided && "text-black-300 line-through")}>
            {entry.authorName}
          </p>
          <Badge tone="neutral" size="sm" className="capitalize">
            {entry.authorRole}
          </Badge>
          {entry.voided ? (
            <Badge tone="danger" size="sm">Voided</Badge>
          ) : null}
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <span className="text-xs text-black-200">Added {formatTime(entry.createdAt)}</span>
          {canVoid ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setVoidOpen(true)}
            >
              Void
            </Button>
          ) : null}
        </div>
      </div>

      {hasBody ? (
        <div className="mt-2">
          <div
            ref={contentRef}
            className={cn(
              "prose prose-sm max-w-none text-sm text-black-400 [&_img]:max-h-56 [&_img]:rounded-lg [&_p]:my-1",
              !expanded && "line-clamp-4",
            )}
            dangerouslySetInnerHTML={{ __html: entry.bodyHtml! }}
          />
          {isClamped || expanded ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-primary-500 hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          ) : null}
        </div>
      ) : null}

      {entry.voided && lastVoid ? (
        <div className="mt-2 rounded-lg border border-error-100 bg-error-50/60 px-3 py-2">
          <p className="text-xs font-semibold text-error-700">
            Voided by {lastVoid.voidedByName} · {formatTime(lastVoid.voidedAt)}
          </p>
          <p className="text-xs text-error-900/80">{lastVoid.reason}</p>
          {entry.voids.length > 1 ? (
            <p className="mt-1 text-xs text-error-700/70">
              Voided {entry.voids.length} times — see report for full history.
            </p>
          ) : null}
        </div>
      ) : null}

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

DailyLogEntryRow.displayName = "DailyLogEntryRow";

export { DailyLogEntryRow, type DailyLogEntryRowProps };
