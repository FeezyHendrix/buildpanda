import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/atoms/button";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Spinner } from "@/components/atoms/spinner";
import { preconApi, type PreconProgramme } from "@/api/precon";
import { preconKeys } from "@/hooks/query-keys";
import { useGeneratePreconProgramme, usePreconProgramme, useSetPreconProgrammeStart } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ProgrammeChart } from "./programme-chart";
import { ProgrammeTable } from "./programme-table";

// Step 3 of the take-off: the programme drafted from the verified bill, in two
// views of the same rows. Panda AI drafts tasks, durations, milestones and
// dependencies; the scheduler computes dates, float and the critical path; a
// person verifies or edits any of it here.

const DRAFT_TIMEOUT_MS = 5 * 60 * 1000;
const PROGRAMME_FEED = /programme/i;
const PROGRAMME_FAILED = /programme generation failed/i;
const longDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

type View = "table" | "chart";

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : longDate.format(date);
};
const fingerprintOf = (p: PreconProgramme | undefined) => (p ? `${p.tasks.length}:${p.tasks[0]?.id ?? ""}` : "");
const slugify = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="tablist" aria-label="Programme view" className="inline-flex overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
      {(["table", "chart"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          className={cn("px-3 py-1.5", view === v ? "bg-primary-50 text-primary-700" : "text-gray-500 hover:bg-gray-50")}
          onClick={() => onChange(v)}
        >
          {v === "table" ? "Table" : "Chart"}
        </button>
      ))}
    </div>
  );
}
ViewToggle.displayName = "ViewToggle";

interface Props {
  sessionId: string;
  sessionTitle: string;
  editable?: boolean;
}

export function ProgrammeStep({ sessionId, sessionTitle, editable = true }: Props) {
  const [view, setView] = useState<View>("table");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [awaited, setAwaited] = useState<{ fingerprint: string; deadline: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  // Drafting progress arrives on the realtime feed; the programme has no status
  // of its own, so "still drafting" means the task list has not changed yet.
  const { data: feed = [] } = useQuery({
    queryKey: preconKeys.progressFeed(sessionId),
    queryFn: () => [] as string[],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const latestMessage = useMemo(() => [...feed].reverse().find((m) => PROGRAMME_FEED.test(m)) ?? null, [feed]);
  const failed = latestMessage !== null && PROGRAMME_FAILED.test(latestMessage);

  const generate = useGeneratePreconProgramme(sessionId);
  const setStart = useSetPreconProgrammeStart(sessionId);
  const stillDrafting = (current: PreconProgramme | undefined) =>
    awaited !== null && !failed && fingerprintOf(current) === awaited.fingerprint;
  const { data: programme, isPending } = usePreconProgramme(sessionId, {
    drafting: (current) => stillDrafting(current) && Date.now() < (awaited?.deadline ?? 0),
  });

  const tasks = programme?.tasks ?? [];
  const progress = programme?.progress ?? { total: 0, verified: 0 };
  const criticalCount = tasks.filter((t) => t.isCritical && t.status !== "rejected" && !tasks.some((c) => c.parentTaskId === t.id)).length;
  const unverified = tasks.filter((t) => t.status !== "verified" && t.status !== "rejected").length;
  const drafting = stillDrafting(programme) && Date.now() < (awaited?.deadline ?? 0);
  const timedOut = stillDrafting(programme) && !drafting;

  const startDraft = () => {
    const current = fingerprintOf(programme);
    generate.mutate(undefined, {
      onSuccess: () => setAwaited({ fingerprint: current, deadline: Date.now() + DRAFT_TIMEOUT_MS }),
      onError: (error) => toast(getApiErrorMessage(error, "Could not start the programme draft."), "error"),
    });
  };

  async function download() {
    setExporting(true);
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
      toast(getApiErrorMessage(error, "Could not export the programme."), "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Programme of work</h2>
          <p className="text-xs text-gray-500">
            {tasks.length > 0
              ? `${formatDate(programme?.startDate ?? null)} → ${formatDate(programme?.finishDate ?? null)} · ${progress.verified} of ${progress.total} tasks verified${criticalCount > 0 ? ` · ${criticalCount} on the critical path` : ""}`
              : "Panda AI drafts tasks, durations and dependencies from the verified bill. The scheduler works out dates and the critical path."}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tasks.length > 0 ? <ViewToggle view={view} onChange={setView} /> : null}
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Start
            <input
              type="date"
              className="h-8 rounded-lg border-0 bg-[#F6F6F6] px-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100"
              value={programme ? programme.startDate.slice(0, 10) : ""}
              disabled={!programme || !editable || setStart.isPending}
              onChange={(e) => {
                if (e.target.value.length !== 10) return;
                setStart.mutate(e.target.value, {
                  onError: (error) => toast(getApiErrorMessage(error, "Could not move the programme start."), "error"),
                });
              }}
            />
          </label>
          {editable ? (
            <Button size="sm" variant="secondary" loading={generate.isPending} disabled={drafting} onClick={startDraft}>
              {tasks.length > 0 ? (unverified > 0 ? `Redraft ${unverified} unverified` : "Redraft programme") : "Draft programme"}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" loading={exporting} disabled={tasks.length === 0} onClick={() => void download()}>
            Download for Microsoft Project
          </Button>
        </div>
      </header>

      {tasks.length > 0 ? (
        <ProgressBar value={progress.verified} max={Math.max(1, progress.total)} tone="success" size="sm" className="rounded-none" />
      ) : null}

      {drafting ? (
        <div className="flex items-center gap-3 border-b border-gray-100 bg-primary-50 px-4 py-2.5">
          <Spinner size="xs" />
          <p className="truncate text-xs text-primary-700">{latestMessage ?? "Sequencing work packages and estimating durations from the bill."}</p>
        </div>
      ) : null}
      {failed ? <p className="border-b border-gray-100 bg-red-50 px-4 py-2 text-xs text-red-700">{latestMessage}</p> : null}
      {timedOut ? (
        <p className="border-b border-gray-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          The draft is taking longer than expected. Reload the page to check whether Panda AI has finished.
        </p>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-semibold text-gray-900">No programme drafted yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-gray-500">
            Every measured element becomes a work package with a duration, a stated basis and its dependencies. Review
            them before anyone plans against them.
          </p>
          {editable ? (
            <Button className="mt-4" loading={generate.isPending || drafting} onClick={startDraft}>
              Draft programme
            </Button>
          ) : null}
        </div>
      ) : view === "chart" ? (
        <ProgrammeChart sessionId={sessionId} programme={programme!} editable={editable} onSelectTask={setSelectedTaskId} />
      ) : (
        <ProgrammeTable sessionId={sessionId} programme={programme!} editable={editable} selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} />
      )}
    </section>
  );
}
ProgrammeStep.displayName = "ProgrammeStep";
