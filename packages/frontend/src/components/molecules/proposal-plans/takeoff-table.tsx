import { useMemo, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PencilRuler } from "lucide-react";
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

// Who measured it: the engine or a person. A hand-built take-off has no
// drawing behind it; a measured one always does.
function OriginBadge({ session }: { session: PreconSession }) {
  const byPandaAi = session.takeoffKind !== "manual";
  return byPandaAi ? (
    <Badge tone="info">Panda AI</Badge>
  ) : (
    <Badge tone="neutral">Manual</Badge>
  );
}
OriginBadge.displayName = "OriginBadge";

function stateLabel(s: PreconSession): string {
  return s.supersededBy ? "Superseded" : s.stale ? "Drawing revised" : PRECON_STATUS_LABEL[s.status];
}

function StateCell({ session }: { session: PreconSession }) {
  if (session.supersededBy) return <Badge tone="neutral">Superseded</Badge>;
  // WS-M3B: the drawing moved on; the take-off is still readable but needs re-measuring
  if (session.stale) {
    return (
      <span className="flex min-w-0 flex-col gap-0.5">
        <Badge tone="warning">Drawing revised</Badge>
        <span className="truncate text-xs text-amber-700">
          Measured on an earlier revision{session.stale.newerRevision ? ` · now Rev ${session.stale.newerRevision}` : ""}
        </span>
      </span>
    );
  }
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

function ActionsCell({ session }: { session: PreconSession }) {
  const retry = useRetryPreconSession(session.id);
  const stop = (e: MouseEvent) => e.stopPropagation();
  const primary = session.status === "reviewing" && !session.supersededBy;
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
  {
    id: "title",
    header: "Take-off",
    accessor: (s) => s.title,
    sortable: true,
    cell: (s) => (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-gray-900">{s.title}</span>
        <OriginBadge session={s} />
      </span>
    ),
  },
  { id: "scope", header: "Scope", accessor: (s) => describeScope(s.scope), sortable: true, filter: { kind: "select" }, width: "11rem" },
  {
    id: "revision",
    header: "Rev",
    accessor: (s) => (s.planId ? s.revision : null),
    sortable: true,
    align: "center",
    width: "4.5rem",
    cell: (s) => <span className="font-mono text-xs text-gray-600">{s.planId ? s.revision : "—"}</span>,
  },
  { id: "state", header: "State", accessor: stateLabel, sortable: true, filter: { kind: "select" }, width: "13rem", cell: (s) => <StateCell session={s} /> },
  { id: "lines", header: "Lines", accessor: (s) => s.lines?.total ?? 0, sortable: true, align: "right", width: "5rem" },
  { id: "verified", header: "Verified", accessor: (s) => s.lines?.verified ?? 0, sortable: true, align: "right", width: "6rem" },
  {
    id: "attention",
    header: "Needs attention",
    accessor: (s) => s.lines?.attention ?? 0,
    sortable: true,
    align: "right",
    width: "8rem",
    cell: (s) => {
      const n = s.lines?.attention ?? 0;
      return n > 0 ? <Badge tone="warning">{n}</Badge> : <span className="text-gray-400">0</span>;
    },
  },
  {
    id: "measured",
    header: "Measured",
    accessor: (s) => s.createdAt,
    sortable: true,
    filter: { kind: "date" },
    width: "9rem",
    cell: (s) => <span className="text-gray-600">{formatTimeAgo(s.createdAt)}</span>,
  },
  { id: "actions", header: "", accessor: () => null, align: "right", width: "9rem", cell: (s) => <ActionsCell session={s} /> },
];

interface Props {
  sessions: PreconSession[];
  isLoading: boolean;
  /** The table's one primary action: open a drawing and draw the lines yourself. */
  onMeasureByHand: () => void;
}

/**
 * Every current take-off on the proposal as one table; a row opens the
 * take-off workspace. Superseded revisions stay in the database and reachable
 * by link, but never clutter this list.
 */
export function TakeoffTable({ sessions, isLoading, onMeasureByHand }: Props) {
  const navigate = useNavigate();
  const rows = useMemo(() => sessions.filter((s) => s.supersededBy === null), [sessions]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Take-offs</h2>
        <Button size="sm" onClick={onMeasureByHand}>
          <PencilRuler className="mr-1.5 size-3.5" aria-hidden="true" />
          Measure by hand
        </Button>
      </div>
      <DataGrid
        data={rows}
        columns={COLUMNS}
        getRowId={(s) => s.id}
        searchKeys={[(s) => s.title, (s) => describeScope(s.scope)]}
        searchPlaceholder="Search take-offs"
        initialSort={{ columnId: "measured", direction: "desc" }}
        isLoading={isLoading}
        onRowClick={(s) => navigate(`/sales/takeoff/${s.id}`)}
        emptyState={
          <EmptyState
            title="No measurements yet"
            description="Measure a drawing by hand here, or choose Measure with Panda AI on the Drawings tab."
            variant="inline"
          />
        }
      />
    </div>
  );
}
TakeoffTable.displayName = "TakeoffTable";
