import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { PreconSession } from "@/api/precon";
import type { TakeoffJob } from "@/api/proposals";
import { preconKeys } from "@/hooks/query-keys";
import { formatTimeAgo } from "@/lib/formatters";
import { DWG_STATUS_LABEL, DWG_STATUS_TONE } from "@/lib/precon-meta";
import { TakeoffCard } from "./takeoff-card";
import { groupTakeoffs } from "./takeoff-groups";

interface Props {
  proposalId: string;
  sessions: PreconSession[];
  jobs: TakeoffJob[];
  selectedId?: string | null;
  onSelect?: (sessionId: string) => void;
  onCreateBlank: () => void;
  creatingBlank: boolean;
}

// A DWG job that never got a session (runs from before the shell session
// existed) is the only job shown on its own; every other job is its session.
function LegacyJobRow({ job }: { job: TakeoffJob }) {
  const running = job.status === "pending" || job.status === "processing";
  const detail =
    job.status === "completed"
      ? `${job.elementCount} lines added to the BoQ tab`
      : job.status === "failed"
        ? `The automated take-off failed before it produced a take-off · ${formatTimeAgo(job.createdAt)}`
        : `DWG automated take-off · started ${formatTimeAgo(job.createdAt)}`;
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{job.fileName}</p>
          <Badge tone={DWG_STATUS_TONE[job.status]} dot={running}>
            {DWG_STATUS_LABEL[job.status]}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500" title={job.error ?? undefined}>
          {detail}
        </p>
      </div>
    </li>
  );
}
LegacyJobRow.displayName = "LegacyJobRow";

export function TakeoffList({ proposalId, sessions, jobs, selectedId = null, onSelect, onCreateBlank, creatingBlank }: Props) {
  const qc = useQueryClient();

  // A completed DWG job becomes a take-off, so the session list is refreshed
  // once when a job flips to completed — not on every poll while it runs, and
  // not for jobs that were already complete when the tab opened.
  const seenCompleted = useRef<Set<string> | null>(null);
  useEffect(() => {
    const completed = jobs.filter((j) => j.status === "completed").map((j) => j.id);
    if (seenCompleted.current === null) {
      seenCompleted.current = new Set(completed);
      return;
    }
    const seen = seenCompleted.current;
    const fresh = completed.filter((id) => !seen.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) seen.add(id);
    void qc.invalidateQueries({ queryKey: [...preconKeys.sessions(), proposalId] });
  }, [jobs, proposalId, qc]);

  const groups = groupTakeoffs(sessions);
  const legacyJobs = jobs.filter((j) => !j.sessionId);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 text-primary-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Take-offs</p>
            <p className="max-w-2xl text-xs text-gray-500">
              A take-off is Panda AI's unpriced measurement of one drawing. Review its lines, then bring them into the
              estimate. Measuring a drawing again makes a new revision of the same take-off; earlier revisions are kept
              underneath it.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      {groups.length === 0 && legacyJobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          Nothing measured yet. Upload a PDF or DWG on the Drawings tab and choose <strong>Measure with Panda AI</strong>.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <TakeoffCard
              key={group.key}
              group={group}
              selected={group.current.id === selectedId || group.earlier.some((s) => s.id === selectedId)}
              onSelect={(id) => onSelect?.(id)}
            />
          ))}
          {legacyJobs.map((job) => (
            <LegacyJobRow key={job.id} job={job} />
          ))}
        </ul>
      )}
    </section>
  );
}
TakeoffList.displayName = "TakeoffList";
