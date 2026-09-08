import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { PreconSession } from "@/api/precon";
import type { TakeoffJob } from "@/api/proposals";
import { proposalKeys } from "@/hooks/query-keys";
import { useRetryPreconSession } from "@/hooks/use-precon";
import { formatTimeAgo } from "@/lib/formatters";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import {
  DWG_STATUS_LABEL,
  DWG_STATUS_TONE,
  PRECON_STATUS_LABEL,
  PRECON_STATUS_TONE,
  describeScope,
} from "@/lib/precon-meta";

interface Props {
  proposalId: string;
  sessions: PreconSession[];
  jobs: TakeoffJob[];
  onCreateBlank: () => void;
  creatingBlank: boolean;
}

function sessionDetail(session: PreconSession): string {
  if (session.status === "failed") return session.error ?? "Panda AI could not measure this drawing.";
  if (session.status === "generating" || session.status === "uploading") {
    const latest = session.progressLog[session.progressLog.length - 1];
    return latest?.message ?? "Waiting for a worker…";
  }
  return `${describeScope(session.scope)} · started ${formatTimeAgo(session.createdAt)}`;
}

function SessionRow({ session }: { session: PreconSession }) {
  const retry = useRetryPreconSession(session.id);
  const running = session.status === "generating" || session.status === "uploading";
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{session.title}</p>
          <Badge tone={PRECON_STATUS_TONE[session.status]} dot={running}>
            {PRECON_STATUS_LABEL[session.status]}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">{sessionDetail(session)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {session.status === "failed" ? (
          <Button
            size="sm"
            variant="ghost"
            loading={retry.isPending}
            onClick={() =>
              retry.mutate(undefined, {
                onError: (e) => toast(getApiErrorMessage(e, "Could not retry the take-off."), "error"),
              })
            }
          >
            Retry
          </Button>
        ) : null}
        <Link to={`/sales/takeoff/${session.id}`}>
          <Button size="sm" variant={session.status === "reviewing" ? "primary" : "ghost"}>
            {session.status === "reviewing" ? "Review" : "Open"}
          </Button>
        </Link>
      </div>
    </li>
  );
}
SessionRow.displayName = "SessionRow";

function JobRow({ job }: { job: TakeoffJob }) {
  const running = job.status === "pending" || job.status === "processing";
  const detail =
    job.status === "completed"
      ? job.sessionId
        ? `${job.elementCount} lines ready to review`
        : `${job.elementCount} lines added to the BoQ tab`
      : job.status === "failed"
        ? (job.error ?? "The automated take-off failed.")
        : `DWG automated take-off · started ${formatTimeAgo(job.createdAt)}`;
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{job.fileName}</p>
          <Badge tone={DWG_STATUS_TONE[job.status]} dot={running}>
            {DWG_STATUS_LABEL[job.status]}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">{detail}</p>
      </div>
      {job.sessionId ? (
        <Link to={`/sales/takeoff/${job.sessionId}`} className="shrink-0">
          <Button size="sm" variant="primary">
            Review
          </Button>
        </Link>
      ) : null}
    </li>
  );
}
JobRow.displayName = "JobRow";

type Entry = { kind: "session"; at: string; session: PreconSession } | { kind: "job"; at: string; job: TakeoffJob };

export function TakeoffList({ proposalId, sessions, jobs, onCreateBlank, creatingBlank }: Props) {
  const qc = useQueryClient();

  // A DWG job writes straight into the proposal BoQ, so the BoQ tab is refreshed
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
    void qc.invalidateQueries({ queryKey: proposalKeys.boq(proposalId) });
  }, [jobs, proposalId, qc]);

  // fresh array built here, so sorting in place cannot touch the query cache
  const entries: Entry[] = [
    ...sessions.map((session): Entry => ({ kind: "session", at: session.createdAt, session })),
    ...jobs.map((job): Entry => ({ kind: "job", at: job.createdAt, job })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Panda AI take-offs</p>
            <p className="text-xs text-gray-500">Measured drawings and hand-priced sheets. Review each one before applying it.</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" loading={creatingBlank} onClick={onCreateBlank}>
          + Blank pricing sheet
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500">
          Nothing measured yet. Upload a PDF or DWG drawing above and choose <strong>Measure with Panda AI</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((entry) =>
            entry.kind === "session" ? (
              <SessionRow key={entry.session.id} session={entry.session} />
            ) : (
              <JobRow key={entry.job.id} job={entry.job} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
TakeoffList.displayName = "TakeoffList";
