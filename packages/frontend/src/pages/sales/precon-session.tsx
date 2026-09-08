import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import { PreconBoqPanel } from "@/components/molecules/precon-boq-panel";
import { PreconSheetViewer, type PreconTool } from "@/components/molecules/precon-sheet-viewer";
import { PreconOutputPanel } from "@/components/molecules/precon-output-panel";
import { ProgrammeStep } from "@/components/molecules/precon-programme/programme-step";
import { PreconGenerateFeed } from "@/components/molecules/precon-session/precon-generate-feed";
import { ExtractionReportPanel } from "@/components/molecules/precon-session/extraction-report";
import { PreconSessionHeader } from "@/components/molecules/precon-session/precon-session-header";
import { PreconSessionSkeleton } from "@/components/molecules/precon-session/precon-session-skeleton";
import { AssistDrawer } from "@/components/molecules/precon-assist/assist-drawer";
import { Sparkles } from "lucide-react";
import {
  PRECON_STEPS,
  PreconStepper,
  type PreconStepKey,
} from "@/components/molecules/precon-session/precon-stepper";
import { StructureFields } from "@/components/molecules/precon-session/structure-fields";
import { usePreconChannel, usePreconSnapshot, useRetryPreconSession } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { PreconSessionStatus } from "@/api/precon";

const COMPLETION_HOLD_MS = 1200;
const REVIEWABLE: ReadonlySet<PreconSessionStatus> = new Set(["reviewing", "output"]);

function stepForStatus(status: PreconSessionStatus): PreconStepKey {
  return REVIEWABLE.has(status) ? "review" : "measure";
}

export default function PreconSessionPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const { data: snapshot, isPending, isError, error } = usePreconSnapshot(sessionId);
  usePreconChannel(sessionId || null);
  const retry = useRetryPreconSession(sessionId);

  const [step, setStep] = useState<PreconStepKey | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [tool, setTool] = useState<PreconTool>("select");
  // a prompt can ask the viewer to zoom; handed down by value so the same
  // request can be made twice in a row
  const [zoomRequest, setZoomRequest] = useState<{ seq: number; kind: "in" | "out" | "fit" } | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);

  // Hold the "ready" card briefly when a run finishes in front of the user,
  // then move them into review. A session already reviewing on first load
  // skips the ceremony.
  const status = snapshot?.session.status;
  const previousStatus = useRef<PreconSessionStatus | undefined>(undefined);
  useEffect(() => {
    const finished = previousStatus.current === "generating" && status === "reviewing";
    previousStatus.current = status;
    if (!finished) return;
    setJustCompleted(true);
    const timer = setTimeout(() => {
      setJustCompleted(false);
      setStep((prev) => (prev === null || prev === "measure" ? "review" : prev));
    }, COMPLETION_HOLD_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const measurableSheets = useMemo(() => (snapshot?.sheets ?? []).filter((s) => s.status !== "pending"), [snapshot?.sheets]);
  const activeSheet =
    measurableSheets.find((s) => s.id === activeSheetId) ??
    measurableSheets.find((s) => s.status === "measured" && s.kind === "floor-plan") ??
    measurableSheets.find((s) => s.status === "measured") ??
    measurableSheets[0] ??
    null;

  if (isPending) return <PreconSessionSkeleton />;

  if (isError || !snapshot) {
    return (
      <div className="p-6">
        <EmptyState
          title="Take-off not found"
          description={getApiErrorMessage(error, "This take-off may have been deleted or belongs to another workspace.")}
          action={
            <Link to="/sales/proposals">
              <Button variant="secondary">Back to proposals</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { session } = snapshot;
  const reviewing = REVIEWABLE.has(session.status);
  // All sheets, not just measurable ones: a session still generating has only
  // pending sheets and must not be mistaken for a hand-priced one.
  const hasDrawings = snapshot.sheets.length > 0;
  const areasOnly = session.scope.kind === "areas";
  const steps = PRECON_STEPS.filter((s) => (s.key === "measure" ? hasDrawings : s.key === "programme" ? !areasOnly : true));
  const reachable = new Set<PreconStepKey>(reviewing ? (areasOnly ? ["review", "output"] : ["review", "programme", "output"]) : []);
  const effectiveStep: PreconStepKey = justCompleted ? "measure" : (step ?? (hasDrawings ? stepForStatus(session.status) : "review"));

  const runRetry = () =>
    retry.mutate(undefined, {
      onSuccess: () => setStep(null),
      onError: (e) => toast(getApiErrorMessage(e, "Could not retry the take-off."), "error"),
    });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <PreconSessionHeader snapshot={snapshot} step={effectiveStep} reviewing={reviewing} onSelectStep={setStep} />
      <div className="flex items-end justify-between gap-4">
        <PreconStepper steps={steps} active={effectiveStep} reachable={reachable} onSelect={setStep} />
        {reviewing ? (
          <Button size="sm" variant="secondary" className="mb-3 shrink-0" onClick={() => setAssistOpen(true)}>
            <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
            Ask Panda AI
          </Button>
        ) : null}
      </div>
      {/* The programme lives on the output step until the programme workstream lands its own step. */}
      <AssistDrawer
        open={assistOpen}
        onOpenChange={setAssistOpen}
        sessionId={sessionId}
        surface={effectiveStep === "programme" ? "programme" : "bill"}
        surfaceLabel={effectiveStep === "programme" ? "Programme" : "Bill"}
        context={{ activeSheetId: activeSheet?.id, tool }}
        onViewerCommand={({ tool: nextTool, sheetId, zoom }) => {
          if (sheetId) setActiveSheetId(sheetId);
          if (nextTool) setTool(nextTool);
          if (zoom) setZoomRequest({ seq: Date.now(), kind: zoom });
          setStep("review");
        }}
      />

      {effectiveStep === "measure" ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
          <PreconGenerateFeed
            session={session}
            justCompleted={justCompleted}
            itemsCount={snapshot.rows.filter((r) => r.rowType === "item").length}
            billsCount={snapshot.bills.length}
            onRetry={runRetry}
            retrying={retry.isPending}
          />
          {session.extraction
            ? Object.entries(session.extraction.sheets).map(([sheetId, report]) => (
                <ExtractionReportPanel key={sheetId} report={report} title={snapshot.sheets.find((s) => s.id === sheetId)?.code ?? undefined} />
              ))
            : null}
        </div>
      ) : effectiveStep === "programme" ? (
        <ProgrammeStep sessionId={sessionId} sessionTitle={session.title} />
      ) : effectiveStep === "output" ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
          <PreconOutputPanel snapshot={snapshot} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {structureOpen ? (
            <StructureFields session={session} onClose={() => setStructureOpen(false)} />
          ) : hasDrawings ? (
            <button
              type="button"
              onClick={() => setStructureOpen(true)}
              className="self-start text-xs font-medium text-primary-600 hover:underline"
            >
              {session.structureContext?.confidence === "high" ? "Structure reading confirmed · edit" : "Check the structure reading Panda AI used"}
            </button>
          ) : null}
          <div className={cn("grid min-h-0 flex-1 gap-4", hasDrawings && "lg:grid-cols-[1fr_420px]")}>
            {hasDrawings ? (
              <PreconSheetViewer
                sessionId={sessionId}
                sheets={measurableSheets}
                activeSheet={activeSheet}
                onSelectSheet={setActiveSheetId}
                geometries={snapshot.geometries}
                rows={snapshot.rows}
                selectedRowId={selectedRowId}
                onSelectRow={setSelectedRowId}
                tool={tool}
                onToolChange={setTool}
                zoomRequest={zoomRequest}
              />
            ) : null}
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
        </div>
      )}
    </div>
  );
}
