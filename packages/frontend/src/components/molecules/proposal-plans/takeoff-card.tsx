import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, FileText, PencilRuler, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import type { PreconSession } from "@/api/precon";
import { useRetryPreconSession } from "@/hooks/use-precon";
import { formatTimeAgo } from "@/lib/formatters";
import { getApiErrorMessage } from "@/lib/api-error";
import { PRECON_STATUS_LABEL, PRECON_STATUS_TONE, describeScope } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { TakeoffGroup } from "./takeoff-groups";

const RUNNING = new Set(["generating", "uploading"]);

function linesSummary(session: PreconSession): string | null {
  const lines = session.lines;
  if (!lines || lines.total === 0) return null;
  const parts = [`${lines.total} lines`, `${lines.verified} verified`];
  if (lines.attention > 0) parts.push(`${lines.attention} need attention`);
  return parts.join(" · ");
}

function RunningLine({ session }: { session: PreconSession }) {
  const latest = session.progressLog[session.progressLog.length - 1];
  return (
    <p className="flex items-center gap-2 text-xs text-gray-600">
      <Spinner size="xs" />
      {latest?.message ?? "Waiting for a worker…"}
    </p>
  );
}
RunningLine.displayName = "RunningLine";

function FailedLine({ session }: { session: PreconSession }) {
  const retry = useRetryPreconSession(session.id);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
      <p className="flex items-start gap-1.5 text-xs text-red-700">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span className="line-clamp-2">{session.error ?? "Panda AI could not measure this drawing."}</span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        loading={retry.isPending}
        onClick={(e) => {
          e.stopPropagation();
          retry.mutate(undefined, { onError: (err) => toast(getApiErrorMessage(err, "Could not retry the take-off."), "error") });
        }}
      >
        Retry
      </Button>
    </div>
  );
}
FailedLine.displayName = "FailedLine";

function EarlierRevisionRow({ session }: { session: PreconSession }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="flex min-w-0 items-center gap-2 text-gray-500">
        <span className="font-mono text-[11px] text-gray-400">Rev {session.revision}</span>
        <span className="truncate">measured {formatTimeAgo(session.createdAt)}</span>
        {linesSummary(session) ? <span className="hidden truncate text-gray-400 sm:inline">· {linesSummary(session)}</span> : null}
        <Badge tone="neutral">Superseded</Badge>
      </span>
      <Link to={`/sales/takeoff/${session.id}`} className="shrink-0 text-primary-600 hover:underline">
        Open
      </Link>
    </li>
  );
}
EarlierRevisionRow.displayName = "EarlierRevisionRow";

interface Props {
  group: TakeoffGroup;
  selected: boolean;
  onSelect: (sessionId: string) => void;
}

/**
 * One take-off: the current revision with its state and line counts, the
 * action a reviewer takes next, and the earlier revisions folded underneath.
 */
export function TakeoffCard({ group, selected, onSelect }: Props) {
  const { current, earlier } = group;
  const [showEarlier, setShowEarlier] = useState(false);
  const running = RUNNING.has(current.status);
  const fromDrawing = current.planId !== null;
  const Icon = fromDrawing ? PencilRuler : FileText;
  const summary = linesSummary(current);
  return (
    <li
      className={cn(
        "rounded-xl border bg-white transition-colors",
        selected ? "border-primary-300 ring-2 ring-primary-100" : "border-gray-200 hover:border-gray-300",
      )}
    >
      <div className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3" onClick={() => onSelect(current.id)}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">{current.title}</p>
              <Badge tone={PRECON_STATUS_TONE[current.status]} dot={running}>
                {PRECON_STATUS_LABEL[current.status]}
              </Badge>
              {fromDrawing ? <span className="font-mono text-[11px] text-gray-400">Rev {current.revision}</span> : null}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {describeScope(current.scope)}
              {fromDrawing ? " · from the drawing" : " · built by hand"}
              {" · "}
              {running ? "started" : "measured"} {formatTimeAgo(current.createdAt)}
              {summary ? ` · ${summary}` : ""}
            </p>
            <div className="mt-2">
              {running ? <RunningLine session={current} /> : current.status === "failed" ? <FailedLine session={current} /> : null}
            </div>
          </div>
        </div>
        <Link to={`/sales/takeoff/${current.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Button size="sm" variant={current.status === "reviewing" ? "primary" : "secondary"}>
            {current.status === "reviewing" ? "Review" : "Open"}
          </Button>
        </Link>
      </div>
      {earlier.length > 0 ? (
        <div className="border-t border-gray-100 px-4 py-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            onClick={() => setShowEarlier((v) => !v)}
            aria-expanded={showEarlier}
          >
            {showEarlier ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
            {earlier.length === 1 ? "1 earlier revision" : `${earlier.length} earlier revisions`}
          </button>
          {showEarlier ? (
            <ul className="mt-1 divide-y divide-gray-100">
              {earlier.map((s) => (
                <EarlierRevisionRow key={s.id} session={s} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
TakeoffCard.displayName = "TakeoffCard";
