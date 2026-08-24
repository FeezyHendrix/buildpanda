import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/atoms/button";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Spinner } from "@/components/atoms/spinner";
import { PreconProgrammeTaskRow } from "@/components/molecules/precon-programme-task-row";
import { preconApi } from "@/api/precon";
import { preconKeys } from "@/hooks/query-keys";
import {
  useGeneratePreconProgramme,
  usePreconProgramme,
  useSetPreconProgrammeStart,
} from "@/hooks/use-precon";
import type { PreconProgramme } from "@/api/precon";

const DRAFT_TIMEOUT_MS = 5 * 60 * 1000;
const PROGRAMME_FEED = /programme/i;
const PROGRAMME_FAILED = /programme generation failed/i;

const longDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : longDate.format(date);
}

function fingerprintOf(programme: PreconProgramme | undefined): string {
  if (!programme) return "";
  return `${programme.tasks.length}:${programme.tasks[0]?.id ?? ""}`;
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
}

function ProgrammeEmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-semibold text-black-500">No programme drafted yet</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-grey-400">
        Panda AI builds the programme from the reviewed bill of quantities — every measured element becomes a work
        package with a duration and a stated basis. Review the durations before anyone plans against them.
      </p>
      <Button className="mt-4" loading={generating} onClick={onGenerate}>
        Generate programme
      </Button>
    </div>
  );
}
ProgrammeEmptyState.displayName = "ProgrammeEmptyState";

function ProgrammeDrafting({ message }: { message: string | null }) {
  return (
    <div className="flex items-center gap-3 border-b border-grey-50 bg-primary-50 px-4 py-3">
      <Spinner size="xs" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary-700">Panda AI is drafting the programme</p>
        <p className="truncate text-xs text-grey-500">
          {message ?? "Sequencing work packages and estimating durations from the bill."}
        </p>
      </div>
    </div>
  );
}
ProgrammeDrafting.displayName = "ProgrammeDrafting";

interface ProgrammePanelProps {
  sessionId: string;
  sessionTitle: string;
}

export function PreconProgrammePanel({ sessionId, sessionTitle }: ProgrammePanelProps) {
  const [awaited, setAwaited] = useState<{ fingerprint: string; deadline: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: feed = [] } = useQuery({
    queryKey: preconKeys.progressFeed(sessionId),
    queryFn: () => [] as string[],
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const latestProgrammeMessage = useMemo(() => {
    for (let i = feed.length - 1; i >= 0; i -= 1) {
      const message = feed[i];
      if (message !== undefined && PROGRAMME_FEED.test(message)) return message;
    }
    return null;
  }, [feed]);

  const failed = latestProgrammeMessage !== null && PROGRAMME_FAILED.test(latestProgrammeMessage);

  const generate = useGeneratePreconProgramme(sessionId);
  const setStart = useSetPreconProgrammeStart(sessionId);

  // generation replaces every task row, so an unchanged fingerprint means the draft is still running
  const stillDrafting = (current: PreconProgramme | undefined) =>
    awaited !== null && !failed && fingerprintOf(current) === awaited.fingerprint;

  const { data: programme, isPending } = usePreconProgramme(sessionId, {
    drafting: (current) => stillDrafting(current) && Date.now() < (awaited?.deadline ?? 0),
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of programme?.tasks ?? []) map.set(task.id, task.name);
    return map;
  }, [programme?.tasks]);

  const startGeneration = () => {
    setNote(null);
    const current = fingerprintOf(programme);
    generate.mutate(undefined, {
      onSuccess: () => setAwaited({ fingerprint: current, deadline: Date.now() + DRAFT_TIMEOUT_MS }),
      onError: (error) => setNote(error instanceof Error ? error.message : "Could not start the programme draft"),
    });
  };

  async function downloadForProject() {
    setExporting(true);
    setNote(null);
    try {
      const blob = await preconApi.exportProgrammeXml(sessionId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `programme-${slugify(sessionTitle)}.xml`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not export the programme");
    } finally {
      setExporting(false);
    }
  }

  const tasks = programme?.tasks ?? [];
  const progress = programme?.progress ?? { total: 0, verified: 0 };
  const waiting = stillDrafting(programme);
  const drafting = waiting && Date.now() < (awaited?.deadline ?? 0);
  const timedOut = waiting && !drafting;

  return (
    <section className="flex flex-col overflow-hidden border border-grey-50 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-grey-50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-black-500">Programme of work</h2>
          <p className="mt-0.5 text-xs text-grey-400">
            Drafted by Panda AI from the reviewed BOQ. Durations stay estimates until a planner verifies them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-grey-500">
            Start
            <input
              type="date"
              className="h-8 border border-grey-50 bg-white px-2 text-sm text-black-500 outline-none focus:border-primary-300"
              value={programme ? programme.startDate.slice(0, 10) : ""}
              disabled={!programme || setStart.isPending}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length !== 10) return;
                setNote(null);
                setStart.mutate(value, {
                  onError: (error) =>
                    setNote(error instanceof Error ? error.message : "Could not move the programme start"),
                });
              }}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            loading={generate.isPending}
            disabled={drafting}
            onClick={startGeneration}
          >
            {tasks.length > 0 ? "Redraft programme" : "Generate programme"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={exporting}
            disabled={tasks.length === 0}
            onClick={() => void downloadForProject()}
          >
            Download for Microsoft Project
          </Button>
        </div>
      </header>

      {tasks.length > 0 ? (
        <div className="border-b border-grey-50 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-grey-500">
              {progress.verified}/{progress.total} tasks verified
            </span>
            <span className="text-xs tabular-nums text-grey-400">
              {formatDate(programme?.startDate ?? null)} → {formatDate(programme?.finishDate ?? null)}
            </span>
          </div>
          <ProgressBar value={progress.verified} max={progress.total} tone="success" size="md" className="mt-2 bg-grey-50" />
        </div>
      ) : null}

      {drafting ? <ProgrammeDrafting message={latestProgrammeMessage} /> : null}

      {failed ? (
        <p className="border-b border-grey-50 bg-error-50 px-4 py-2 text-xs text-error-700">
          {latestProgrammeMessage}
        </p>
      ) : null}

      {timedOut ? (
        <p className="border-b border-grey-50 bg-warning-50 px-4 py-2 text-xs text-grey-700">
          The draft is taking longer than expected. Reload the page to check whether Panda AI has finished.
        </p>
      ) : null}

      {note ? (
        <p className="border-b border-grey-50 bg-warning-50 px-4 py-2 text-xs text-grey-700">{note}</p>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-10">
          <Spinner size="md" />
        </div>
      ) : tasks.length === 0 ? (
        <ProgrammeEmptyState onGenerate={startGeneration} generating={generate.isPending || drafting} />
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-grey-50 bg-grey-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-grey-500">
            <span className="min-w-0 flex-1">Task</span>
            <span className="w-24 shrink-0 text-right">Duration</span>
            <span className="hidden w-44 shrink-0 text-right sm:block">Start → finish</span>
            <span className="w-28 shrink-0 text-right">Status</span>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {tasks.map((task) => (
              <PreconProgrammeTaskRow
                key={task.id}
                task={task}
                sessionId={sessionId}
                nameById={nameById}
                onConflict={setNote}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
PreconProgrammePanel.displayName = "PreconProgrammePanel";
