import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { PreconBoqPanel } from "@/components/molecules/precon-boq-panel";
import { PreconSheetViewer, type PreconTool } from "@/components/molecules/precon-sheet-viewer";
import { PreconOutputPanel } from "@/components/molecules/precon-output-panel";
import { usePreconChannel, usePreconSnapshot } from "@/hooks/use-precon";
import { preconKeys } from "@/hooks/query-keys";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "upload", label: "01 Upload" },
  { key: "generate", label: "02 Generate" },
  { key: "review", label: "03 Review" },
  { key: "output", label: "04 Output" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

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

function GenerateFeed({ sessionId, failed, error }: { sessionId: string; failed: boolean; error: string | null }) {
  const { data: feed = [] } = useQuery({
    queryKey: preconKeys.progressFeed(sessionId),
    queryFn: () => [] as string[],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return (
    <Card className="mx-auto max-w-2xl p-8 text-center">
      {failed ? (
        <>
          <p className="text-sm font-semibold text-red-700">Generation failed</p>
          <p className="mt-2 text-sm text-gray-600">{error ?? "Unknown error"}</p>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <Spinner size="md" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-900">Panda AI is measuring your drawings</p>
          <p className="mt-1 text-sm text-gray-500">Nothing is final — every item goes to human review next.</p>
        </>
      )}
      {feed.length > 0 ? (
        <ul className="mt-6 space-y-1 text-left text-xs text-gray-600">
          {feed.slice(-8).map((message, index) => (
            <li key={`${index}-${message}`} className="truncate">
              {message}
            </li>
          ))}
        </ul>
      ) : null}
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
  useEffect(() => {
    // follow the pipeline until the user starts navigating steps themselves
    if (status && step === null && (status === "reviewing" || status === "output")) setStep("review");
  }, [status, step]);

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
      <div className="flex justify-center py-24">
        <Spinner size="md" />
      </div>
    );
  }

  const effectiveStep: StepKey = step ?? stepForStatus(snapshot.session.status);
  const reviewing = snapshot.session.status === "reviewing" || snapshot.session.status === "output";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-gray-900">{snapshot.session.title}</h1>
          <p className="text-xs text-gray-500">
            {snapshot.progress.verified} of {snapshot.progress.total} items verified
          </p>
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
        />
      ) : effectiveStep === "output" ? (
        <PreconOutputPanel snapshot={snapshot} />
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
