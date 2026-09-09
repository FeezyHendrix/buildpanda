import { Check, X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import type { PreconPhase, PreconSession } from "@/api/precon";
import { phasesForScope, type PhaseMeta } from "@/lib/precon-meta";
import { cn } from "@/lib/utils";

interface Props {
  session: PreconSession;
  justCompleted: boolean;
  itemsCount: number;
  billsCount: number;
  onRetry: () => void;
  retrying: boolean;
}

// The latest message the engine logged for each phase, straight from the
// persisted log — so a reload mid-run shows the same checklist a live client saw.
function latestByPhase(session: PreconSession): Map<PreconPhase, string> {
  const map = new Map<PreconPhase, string>();
  for (const entry of session.progressLog) map.set(entry.phase, entry.message);
  return map;
}

function PhaseRow({
  phase,
  state,
  message,
  last,
}: {
  phase: PhaseMeta;
  state: "done" | "active" | "pending";
  message: string | undefined;
  last: boolean;
}) {
  return (
    <li className={cn("relative flex gap-4 transition-opacity duration-300", state === "pending" ? "opacity-40" : "opacity-100")}>
      {last ? null : (
        <span className={cn("absolute left-2.5 top-6 -ml-px h-full w-px", state === "done" ? "bg-primary-500" : "bg-gray-200")} />
      )}
      <span className="z-10 flex-none bg-white pt-0.5">
        {state === "done" ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary-500 text-white animate-pop motion-reduce:animate-none">
            <Check className="size-3" aria-hidden="true" />
          </span>
        ) : state === "active" ? (
          <span className="flex size-5 items-center justify-center">
            <Spinner size="xs" />
          </span>
        ) : (
          <span className="block size-5 rounded-full border-2 border-gray-300 bg-white" />
        )}
      </span>
      <div className="flex-1 pb-1">
        <p className={cn("text-sm font-medium", state === "active" ? "text-primary-700" : state === "done" ? "text-gray-900" : "text-gray-500")}>
          {phase.label}
        </p>
        {state === "active" ? (
          <p key={message ?? phase.hint} className="mt-1 text-xs text-gray-500 animate-slide-up motion-reduce:animate-none">
            {message ?? phase.hint}
          </p>
        ) : null}
      </div>
    </li>
  );
}
PhaseRow.displayName = "PhaseRow";

export function PreconGenerateFeed({ session, justCompleted, itemsCount, billsCount, onRetry, retrying }: Props) {
  const phases = phasesForScope(session.scope, session.takeoffKind);
  const areas = session.scope.kind === "areas";

  if (justCompleted) {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center animate-fade-in motion-reduce:animate-none">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success-100 animate-pop motion-reduce:animate-none">
          <Check className="size-6 text-success-700" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold text-gray-900">{areas ? "Areas ready" : "Draft ready"}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {areas ? `${itemsCount} spaces measured` : `${itemsCount} items across ${billsCount} bills`}
        </p>
      </Card>
    );
  }

  if (session.status === "failed") {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100">
          <X className="size-6 text-red-600" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-red-700">Panda AI could not finish</h3>
        <p className="mt-2 text-sm text-gray-600">
          {session.error ?? "An unexpected error occurred while measuring your drawings."}
        </p>
        <p className="mt-1 text-xs text-gray-400">Retrying starts the run again from the drawings. Nothing you uploaded is lost.</p>
        <div className="mt-6">
          <Button loading={retrying} onClick={onRetry}>
            Retry take-off
          </Button>
        </div>
      </Card>
    );
  }

  const messages = latestByPhase(session);
  const activeIndex = Math.max(0, phases.findIndex((p) => p.id === session.phase));

  return (
    <Card className="mx-auto max-w-2xl p-8">
      <div className="mb-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Panda AI is working</h2>
        <p className="mt-1 text-sm text-gray-500">
          You can leave this page — progress is saved and the Plans tab shows it too.
        </p>
      </div>
      <ol className="mx-auto max-w-sm space-y-6">
        {phases.map((phase, index) => (
          <PhaseRow
            key={phase.id}
            phase={phase}
            state={index < activeIndex ? "done" : index === activeIndex ? "active" : "pending"}
            message={messages.get(phase.id)}
            last={index === phases.length - 1}
          />
        ))}
      </ol>
    </Card>
  );
}
PreconGenerateFeed.displayName = "PreconGenerateFeed";
