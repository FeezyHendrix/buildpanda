import { useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PencilRuler, Sparkles } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Switcher } from "@/components/atoms/switcher";
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
    <Badge tone="info">
      <Sparkles className="mr-1 size-3" aria-hidden="true" />
      Panda AI
    </Badge>
  ) : (
    <Badge tone="neutral">
      <PencilRuler className="mr-1 size-3" aria-hidden="true" />
      Manual
    </Badge>
  );
}
OriginBadge.displayName = "OriginBadge";

function stateLabel(s: PreconSession): string {
  return s.supersededBy ? "Superseded" : PRECON_STATUS_LABEL[s.status];
}

function StateCell({ session }: { session: PreconSession }) {
  if (session.supersededBy) return <Badge tone="neutral">Superseded</Badge>;
  const running = RUNNING.has(session.status);
  const latest = session.progressLog[session.progressLog.length - 1];
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <Badge tone={PRECON_STATUS_TONE[session.status]} dot={running}>
        {PRECON_STATUS_LABEL[session.status]}
      </Badge>
      {running ? (
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <Spinner size="xs" />
          <span className="truncate">{latest?.message ?? "Waiting for a worker…"}</span>
        </span>
      ) : session.status === "failed" ? (
        <span className="line-clamp-1 text-[11px] text-red-600" title={session.error ?? undefined}>
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
  proposalId: string;
  sessions: PreconSession[];
  isLoading: boolean;
  onCreateBlank: () => void;
  creatingBlank: boolean;
}

/**
 * Every take-off on the proposal as one table: current revisions by default,
 * earlier revisions on request. A row opens the take-off workspace.
 */
export function TakeoffTable({ proposalId, sessions, isLoading, onCreateBlank, creatingBlank }: Props) {
  const navigate = useNavigate();
  const [showEarlier, setShowEarlier] = useState(false);
  const earlierCount = sessions.filter((s) => s.supersededBy !== null).length;
  const rows = useMemo(() => (showEarlier ? sessions : sessions.filter((s) => s.supersededBy === null)), [sessions, showEarlier]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Take-offs</p>
          <p className="max-w-2xl text-xs text-gray-500">
            A take-off is Panda AI's unpriced measurement of one drawing. Review its lines, then bring them into the
            estimate. Measuring a drawing again makes the next revision of the same take-off and keeps the earlier one.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {earlierCount > 0 ? (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Earlier revisions ({earlierCount})
              <Switcher value={showEarlier ? "yes" : "no"} onChange={(v) => setShowEarlier(v === "yes")} />
            </label>
          ) : null}
          <Link to={`/sales/proposals/${proposalId}?tab=drawings`}>
            <Button size="sm" variant="secondary">
              Measure a drawing
            </Button>
          </Link>
          <Button size="sm" variant="ghost" loading={creatingBlank} onClick={onCreateBlank}>
            + Blank take-off
          </Button>
        </div>
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
            title="Nothing measured yet"
            description="Upload a PDF or DWG on the Drawings tab and choose Measure with Panda AI."
            className="py-2"
          />
        }
      />
    </section>
  );
}
TakeoffTable.displayName = "TakeoffTable";
