import { useMemo, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { DataGrid, type DataGridColumn } from "@/components/molecules/data-grid";
import { EmptyState } from "@/components/molecules/empty-state";
import type { PreconSession } from "@/api/precon";
import { useRetryPreconSession } from "@/hooks/use-precon";
import { formatTimeAgo } from "@/lib/formatters";
import { getApiErrorMessage } from "@/lib/api-error";
import { PRECON_STATUS_LABEL, PRECON_STATUS_TONE, describeScope } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";

const RUNNING = new Set(["generating", "uploading"]);

function originLabel(s: PreconSession): string {
  return s.takeoffKind === "manual" ? "By hand" : "Panda AI";
}

function stateLabel(s: PreconSession): string {
  return s.stale ? "Drawing revised" : PRECON_STATUS_LABEL[s.status];
}

// The take-off and, under it, how it was made: who measured, what, which revision.
function TitleCell({ session }: { session: PreconSession }) {
  const meta = [originLabel(session), describeScope(session.scope), session.planId ? `Rev ${session.revision}` : null].filter(Boolean);
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-gray-900">{session.title}</span>
      <span className="truncate text-xs text-ink-muted">{meta.join(" · ")}</span>
    </span>
  );
}
TitleCell.displayName = "TitleCell";

function StateCell({ session }: { session: PreconSession }) {
  // WS-M3B: the drawing moved on; the take-off is still readable but needs re-measuring
  if (session.stale) return <Badge tone="warning">Drawing revised</Badge>;
  const running = RUNNING.has(session.status);
  const latest = session.progressLog[session.progressLog.length - 1];
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <Badge tone={PRECON_STATUS_TONE[session.status]} dot={running}>
        {PRECON_STATUS_LABEL[session.status]}
      </Badge>
      {running ? (
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Spinner size="xs" />
          <span className="truncate">{latest?.message ?? "Waiting for a worker…"}</span>
        </span>
      ) : session.status === "failed" ? (
        <span className="line-clamp-1 text-xs text-red-600" title={session.error ?? undefined}>
          {session.error ?? "Panda AI could not measure this drawing."}
        </span>
      ) : null}
    </span>
  );
}
StateCell.displayName = "StateCell";

// Verified out of total, with the lines still needing a decision beside it.
function LinesCell({ session }: { session: PreconSession }) {
  const lines = session.lines;
  if (!lines || lines.total === 0) return <span className="text-gray-400">0</span>;
  return (
    <span className="inline-flex items-center justify-end gap-2 tabular-nums">
      <span className="text-gray-700">
        {lines.verified} of {lines.total}
      </span>
      {lines.attention > 0 ? <Badge tone="warning">{lines.attention} to check</Badge> : null}
    </span>
  );
}
LinesCell.displayName = "LinesCell";

function ActionsCell({ session }: { session: PreconSession }) {
  const retry = useRetryPreconSession(session.id);
  const stop = (e: MouseEvent) => e.stopPropagation();
  const primary = session.status === "reviewing";
  return (
    <span className="flex items-center justify-end gap-1" onClick={stop}>
      {session.status === "failed" ? (
        <Button
          size="sm"
          variant="ghost"
          loading={retry.isPending}
          onClick={() => retry.mutate(undefined, { onError: (err) => toast(getApiErrorMessage(err, "Could not retry the take-off."), "error") })}
        >
          Retry
        </Button>
      ) : null}
      <Link to={`/sales/takeoff/${session.id}`}>
        <Button size="sm" variant={primary ? "primary" : "ghost"}>
          {primary ? "Review" : "Open"}
        </Button>
      </Link>
    </span>
  );
}
ActionsCell.displayName = "ActionsCell";

const COLUMNS: DataGridColumn<PreconSession>[] = [
  { id: "title", header: "Take-off", accessor: (s) => s.title, sortable: true, cell: (s) => <TitleCell session={s} /> },
  { id: "state", header: "State", accessor: stateLabel, sortable: true, filter: { kind: "select" }, width: "12rem", cell: (s) => <StateCell session={s} /> },
  { id: "verified", header: "Lines verified", accessor: (s) => s.lines?.verified ?? 0, sortable: true, align: "right", width: "11rem", cell: (s) => <LinesCell session={s} /> },
  {
    id: "measured",
    header: "Measured",
    accessor: (s) => s.createdAt,
    sortable: true,
    width: "9rem",
    cell: (s) => <span className="text-gray-600">{formatTimeAgo(s.createdAt)}</span>,
  },
  { id: "actions", header: "", accessor: () => null, align: "right", width: "9rem", cell: (s) => <ActionsCell session={s} /> },
];

interface Props {
  sessions: PreconSession[];
  isLoading: boolean;
}

/**
 * Every current take-off on the proposal as one table; a row opens the
 * take-off workspace. Superseded revisions stay in the database and reachable
 * by link, but never clutter this list. Measuring starts from the drawing.
 */
export function TakeoffTable({ sessions, isLoading }: Props) {
  const navigate = useNavigate();
  const rows = useMemo(() => sessions.filter((s) => s.supersededBy === null), [sessions]);
  return (
    <DataGrid
      data={rows}
      columns={COLUMNS}
      getRowId={(s) => s.id}
      searchKeys={[(s) => s.title, (s) => describeScope(s.scope), originLabel]}
      searchPlaceholder="Search take-offs"
      initialSort={{ columnId: "measured", direction: "desc" }}
      isLoading={isLoading}
      onRowClick={(s) => navigate(`/sales/takeoff/${s.id}`)}
      emptyState={
        <EmptyState
          title="No take-offs yet"
          description="Press Measure on a drawing to start one. It appears here as soon as it is running."
          variant="inline"
        />
      }
    />
  );
}
TakeoffTable.displayName = "TakeoffTable";
