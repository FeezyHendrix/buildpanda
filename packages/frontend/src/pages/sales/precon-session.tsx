import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { PreconBoqPanel } from "@/components/molecules/precon-boq-panel";
import { PreconSheetViewer, type PreconTool } from "@/components/molecules/precon-sheet-viewer";
import { PreconOutputPanel } from "@/components/molecules/precon-output-panel";
import { PreconProgrammePanel } from "@/components/molecules/precon-programme-panel";
import { usePreconChannel, usePreconSnapshot } from "@/hooks/use-precon";
import { preconKeys } from "@/hooks/query-keys";
import { cn } from "@/lib/utils";
import type { StructureContext } from "@/api/precon";

const STEPS = [
  { key: "upload", label: "01 Upload" },
  { key: "generate", label: "02 Generate" },
  { key: "review", label: "03 Review" },
  { key: "output", label: "04 Output" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

function formatStructureContext(ctx: StructureContext | null): string | null {
  if (!ctx || ctx.structureClass === "unknown") return null;

  const parts: string[] = [];
  parts.push(ctx.structureClass.charAt(0).toUpperCase() + ctx.structureClass.slice(1));
  
  if (ctx.buildingType) {
    parts.push(ctx.buildingType.charAt(0).toUpperCase() + ctx.buildingType.slice(1));
  }
  if (ctx.storeys) {
    parts.push(`${ctx.storeys} storeys`);
  }
  if (ctx.structuralSystem && ctx.structuralSystem !== "unknown") {
    const sys = ctx.structuralSystem;
    if (sys === "reinforced-concrete-frame") parts.push("RC frame");
    else if (sys === "load-bearing-masonry") parts.push("Load-bearing masonry");
    else if (sys === "steel-frame") parts.push("Steel frame");
    else if (sys === "composite") parts.push("Composite");
  }
  if (ctx.foundationType && ctx.foundationType !== "unknown") {
    parts.push(`${ctx.foundationType.charAt(0).toUpperCase() + ctx.foundationType.slice(1)} foundation`);
  }
  
  return parts.join(" · ");
}

function stepForStatus(status: string): StepKey {
  if (status === "uploading") return "upload";
  if (status === "generating" || status === "failed") return "generate";
  return "review";
}

function Stepper({ active, reviewing, onSelect }: { active: StepKey; reviewing: boolean; onSelect: (k: StepKey) => void }) {
  const activeIndex = STEPS.findIndex((s) => s.key === active);
  return (
    <nav className="flex items-center gap-4 border-b border-gray-200 pb-3">
      {STEPS.map((step, index) => {
        const reachable = reviewing && (step.key === "review" || step.key === "output");
        return (
          <button
            key={step.key}
            type="button"
            disabled={!reachable}
            onClick={() => onSelect(step.key)}
            className={cn(
              "text-xs font-bold uppercase tracking-wide",
              step.key === active ? "text-primary-600" : index < activeIndex ? "text-gray-700" : "text-gray-400",
              reachable && step.key !== active && "hover:text-primary-500",
            )}
          >
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}
Stepper.displayName = "Stepper";

const GENERATE_PHASES = [
  { id: "reading", label: "Reading drawings", pattern: /Reading .* pages|Measured .*: .* items|No reliable scale|duplicates the plan/i },
  { id: "structure", label: "Detecting structure", pattern: /Detected structure/i },
  { id: "schedules", label: "Reading schedules", pattern: /schedule|Applied schedules|reinforcement|piles/i },
  { id: "building", label: "Building the bill", pattern: /Building up the bill|Elements left/i },
  { id: "pricing", label: "Pricing", pattern: /Priced .* items/i },
  { id: "draft", label: "Draft ready", pattern: /Draft BOQ ready/i },
] as const;

function getPhaseState(feed: string[]) {
  let highestPhaseIdx = -1;
  const phaseMessages = new Map<number, string>();

  for (const msg of feed) {
    const matchedIdx = GENERATE_PHASES.findIndex((phase) => phase.pattern.test(msg));
    if (matchedIdx !== -1) {
      if (matchedIdx > highestPhaseIdx) highestPhaseIdx = matchedIdx;
      phaseMessages.set(matchedIdx, msg);
    } else if (highestPhaseIdx !== -1) {
      phaseMessages.set(highestPhaseIdx, msg);
    }
  }

  const lastMessage = feed.length > 0 ? feed[feed.length - 1] : undefined;
  if (lastMessage && highestPhaseIdx === -1) {
    highestPhaseIdx = 0;
    phaseMessages.set(0, lastMessage);
  } else if (highestPhaseIdx === -1) {
    highestPhaseIdx = 0;
  }

  return { highestPhaseIdx, phaseMessages };
}

function GenerateFeed({ 
  sessionId, 
  failed, 
  error,
  justCompleted,
  itemsCount,
  billsCount
}: { 
  sessionId: string; 
  failed: boolean; 
  error: string | null;
  justCompleted?: boolean;
  itemsCount?: number;
  billsCount?: number;
}) {
  const { data: feed = [] } = useQuery({
    queryKey: preconKeys.progressFeed(sessionId),
    queryFn: () => [] as string[],
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { highestPhaseIdx, phaseMessages } = getPhaseState(feed);

  if (justCompleted) {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center animate-fade-in motion-reduce:animate-none">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-4 animate-pop motion-reduce:animate-none">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Draft ready</h2>
        <p className="mt-2 text-sm text-gray-600">
          {itemsCount} items across {billsCount} bills
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl p-8">
      {failed ? (
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-red-700">Generation failed</h3>
          <p className="mt-2 text-sm text-gray-600">{error ?? "An unexpected error occurred while measuring your drawings."}</p>
          <div className="mt-6">
            <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold text-gray-900">Panda AI is working</h2>
            <p className="mt-1 text-sm text-gray-500">Nothing is final — every item goes to human review next.</p>
          </div>
          
          <div className="mx-auto max-w-sm space-y-6">
            {GENERATE_PHASES.map((phase, idx) => {
              const isActive = idx === highestPhaseIdx;
              const isDone = idx < highestPhaseIdx;
              const isPending = idx > highestPhaseIdx;
              const latestMsg = phaseMessages.get(idx);

              return (
                <div key={phase.id} className={cn("relative flex gap-4 transition-opacity duration-300", isPending ? "opacity-40" : "opacity-100")}>
                  {idx !== GENERATE_PHASES.length - 1 && (
                    <div className={cn(
                      "absolute left-2.5 top-6 h-full w-px -ml-px",
                      isDone ? "bg-primary-500" : "bg-gray-200"
                    )} />
                  )}

                  <div className="flex-none pt-0.5 z-10 bg-white">
                    {isDone ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white animate-pop motion-reduce:animate-none">
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : isActive ? (
                      <div className="flex h-5 w-5 items-center justify-center">
                        <Spinner size="xs" className="text-primary-600" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white" />
                    )}
                  </div>
                  
                  <div className="flex-1 pb-1">
                    <p className={cn("text-sm font-medium", isActive ? "text-primary-700" : isDone ? "text-gray-900" : "text-gray-500")}>
                      {phase.label}
                    </p>
                    {isActive && latestMsg && (
                      <p key={latestMsg} className="mt-1 text-xs text-gray-500 animate-slide-up motion-reduce:animate-none">
                        {latestMsg}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
GenerateFeed.displayName = "GenerateFeed";

export default function PreconSessionPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const { data: snapshot, isPending } = usePreconSnapshot(sessionId);
  usePreconChannel(sessionId || null);

  const [step, setStep] = useState<StepKey | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [tool, setTool] = useState<PreconTool>("select");

  const status = snapshot?.session.status;
  const [justCompleted, setJustCompleted] = useState(false);
  const previousStatusRef = useRef(status);

  useEffect(() => {
    if (previousStatusRef.current === "generating" && status === "reviewing") {
      setJustCompleted(true);
      const timer = setTimeout(() => {
        setJustCompleted(false);
        setStep((prev) => (prev === null || prev === "generate" ? "review" : prev));
      }, 1200); // brief confirmation
      return () => clearTimeout(timer);
    }
    previousStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status && step === null && (status === "reviewing" || status === "output")) {
      if (!justCompleted) setStep("review");
    }
  }, [status, step, justCompleted]);

  const measurableSheets = useMemo(
    () => (snapshot?.sheets ?? []).filter((s) => s.status !== "pending"),
    [snapshot?.sheets],
  );
  const activeSheet =
    measurableSheets.find((s) => s.id === activeSheetId) ??
    measurableSheets.find((s) => s.status === "measured" && s.kind === "floor-plan") ??
    measurableSheets.find((s) => s.status === "measured") ??
    measurableSheets[0] ??
    null;

  if (isPending || !snapshot) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 p-6 animate-pulse motion-reduce:animate-none">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="h-6 w-48 rounded bg-gray-200" />
            <div className="h-4 w-32 rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-8 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4">
            <div className="h-full rounded bg-gray-50" />
          </div>
          <div className="flex w-[400px] flex-col rounded-lg border border-gray-200 bg-white p-4">
            <div className="h-6 w-32 rounded bg-gray-200 mb-4" />
            <div className="space-y-3">
              <div className="h-16 rounded bg-gray-50 border border-gray-100" />
              <div className="h-16 rounded bg-gray-50 border border-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const effectiveStep: StepKey = step ?? (justCompleted ? "generate" : stepForStatus(snapshot.session.status));
  const reviewing = snapshot.session.status === "reviewing" || snapshot.session.status === "output";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {snapshot.session.proposalId ? (
            <Link
              to={`/sales/proposals/${snapshot.session.proposalId}`}
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              &larr; Back to proposal
            </Link>
          ) : null}
          <h1 className="truncate text-lg font-semibold text-gray-900">{snapshot.session.title}</h1>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-500">
              {snapshot.progress.verified} of {snapshot.progress.total} items verified
            </p>
            {(() => {
              const ctxLabel = formatStructureContext(snapshot.session.structureContext);
              if (!ctxLabel) return null;
              return (
                <p className={cn("text-xs text-gray-500", snapshot.session.structureContext?.confidence === "low" && "opacity-75")}>
                  {ctxLabel}{snapshot.session.structureContext?.confidence === "low" && " (low confidence)"}
                </p>
              );
            })()}
          </div>
        </div>
        <Badge tone={reviewing ? "warning" : snapshot.session.status === "failed" ? "danger" : "info"}>
          {snapshot.session.status}
        </Badge>
      </div>

      <Stepper active={effectiveStep} reviewing={reviewing} onSelect={setStep} />

      {effectiveStep === "generate" || effectiveStep === "upload" ? (
        <GenerateFeed
          sessionId={sessionId}
          failed={snapshot.session.status === "failed"}
          error={snapshot.session.error}
          justCompleted={justCompleted}
          itemsCount={snapshot.rows.length}
          billsCount={snapshot.bills.length}
        />
      ) : effectiveStep === "output" ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
          <PreconOutputPanel snapshot={snapshot} />
          <PreconProgrammePanel sessionId={sessionId} sessionTitle={snapshot.session.title} />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_420px]">
          <PreconSheetViewer
            sessionId={sessionId}
            sheets={measurableSheets}
            activeSheet={activeSheet}
            onSelectSheet={(id) => setActiveSheetId(id)}
            geometries={snapshot.geometries}
            rows={snapshot.rows}
            selectedRowId={selectedRowId}
            onSelectRow={setSelectedRowId}
            tool={tool}
            onToolChange={setTool}
          />
          <PreconBoqPanel
            sessionId={sessionId}
            snapshot={snapshot}
            selectedRowId={selectedRowId}
            onSelectRow={(rowId, sheetId) => {
              setSelectedRowId(rowId);
              if (sheetId) setActiveSheetId(sheetId);
            }}
          />
        </div>
      )}
    </div>
  );
}
