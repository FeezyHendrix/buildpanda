import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import type { PreconTool } from "@/components/molecules/precon-sheet-viewer";
import { PreconOutputPanel } from "@/components/molecules/precon-output-panel";
import { ProgrammeStep } from "@/components/molecules/precon-programme/programme-step";
import { PreconGenerateFeed } from "@/components/molecules/precon-session/precon-generate-feed";
import { ExtractionReportPanel } from "@/components/molecules/precon-session/extraction-report";
import { PreconSessionHeader } from "@/components/molecules/precon-session/precon-session-header";
import { PreconSessionSkeleton } from "@/components/molecules/precon-session/precon-session-skeleton";
import { PreconWorkspace, type ZoomRequest } from "@/components/molecules/precon-session/precon-workspace";
import { AssistDrawer } from "@/components/molecules/precon-assist/assist-drawer";
import { Sparkles } from "lucide-react";
import {
  MANUAL_PRECON_STEPS,
  PRECON_STEPS,
  PreconStepper,
  type PreconStepKey,
} from "@/components/molecules/precon-session/precon-stepper";
import { usePreconChannel, usePreconSnapshot, useRetryPreconSession } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { PreconSessionStatus, TakeoffKind } from "@/api/precon";

const COMPLETION_HOLD_MS = 1200;
const REVIEWABLE: ReadonlySet<PreconSessionStatus> = new Set(["reviewing", "output"]);

function stepForStatus(status: PreconSessionStatus): PreconStepKey {
  return REVIEWABLE.has(status) ? "review" : "measure";
}

// Which steps a finished take-off can jump between. A hand take-off has no
// review step: the sheet is where it is measured and verified in one act.
function reachableSteps(reviewing: boolean, manual: boolean, areasOnly: boolean): ReadonlySet<PreconStepKey> {
  if (!reviewing) return new Set();
  const first: PreconStepKey = manual ? "measure" : "review";
  return new Set<PreconStepKey>(areasOnly ? [first, "output"] : [first, "programme", "output"]);
}

export default function PreconSessionPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { data: snapshot, isPending, isError, error } = usePreconSnapshot(sessionId);
  usePreconChannel(sessionId || null);
  const retry = useRetryPreconSession(sessionId);

  const [step, setStep] = useState<PreconStepKey | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [tool, setTool] = useState<PreconTool>("select");
  // a prompt can ask the viewer to zoom; handed down by value so the same
  // request can be made twice in a row
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);

  // Hold the "ready" card briefly when a run finishes in front of the user,
  // then move them into review. A session already reviewing on first load
  // skips the ceremony, and so does a hand take-off: its sheets simply appear.
  const status = snapshot?.session.status;
  const kind: TakeoffKind | undefined = snapshot?.session.takeoffKind;
  const previousStatus = useRef<PreconSessionStatus | undefined>(undefined);
  useEffect(() => {
    const finished = previousStatus.current === "generating" && status === "reviewing";
    previousStatus.current = status;
    if (!finished || kind === "manual") return;
    setJustCompleted(true);
    const timer = setTimeout(() => {
      setJustCompleted(false);
      setStep((prev) => (prev === null || prev === "measure" ? "review" : prev));
    }, COMPLETION_HOLD_MS);
    return () => clearTimeout(timer);
  }, [status, kind]);

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
          action={{ label: "Back to proposals", onClick: () => navigate("/sales/proposals") }}
        />
      </div>
    );
  }

  const { session } = snapshot;
  const manual = session.takeoffKind === "manual";
  const reviewing = REVIEWABLE.has(session.status);
  // All sheets, not just measurable ones: a session still generating has only
  // pending sheets and must not be mistaken for a hand-priced one.
  const hasDrawings = snapshot.sheets.length > 0;
  const areasOnly = session.scope.kind === "areas";
  const steps = (manual ? MANUAL_PRECON_STEPS : PRECON_STEPS).filter((s) =>
    s.key === "measure" ? hasDrawings : s.key === "programme" ? !areasOnly : true,
  );
  const reachable = reachableSteps(reviewing, manual, areasOnly);
  const workspaceStep: PreconStepKey = manual ? "measure" : "review";
  const effectiveStep: PreconStepKey = justCompleted
    ? "measure"
    : (step ?? (manual ? "measure" : hasDrawings ? stepForStatus(session.status) : "review"));
  // A hand take-off's Measure step is the sheet viewer once the sheets have
  // rendered; until then it shows the same feed an AI run does.
  const sheetsReady = manual && reviewing;

  const runRetry = () =>
    retry.mutate(undefined, {
      onSuccess: () => setStep(null),
      onError: (e) => toast(getApiErrorMessage(e, "Could not retry the take-off."), "error"),
    });

  const workspace = (
    <PreconWorkspace
      sessionId={sessionId}
      snapshot={snapshot}
      view={{ sheets: measurableSheets, activeSheet, selectedRowId, tool, zoomRequest }}
      onSelectSheet={setActiveSheetId}
      onSelectRow={(rowId, sheetId) => {
        setSelectedRowId(rowId);
        if (sheetId) setActiveSheetId(sheetId);
      }}
      onToolChange={setTool}
    />
  );

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
          setStep(workspaceStep);
        }}
      />

      {effectiveStep === "measure" && !sheetsReady ? (
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
        workspace
      )}
    </div>
  );
}
