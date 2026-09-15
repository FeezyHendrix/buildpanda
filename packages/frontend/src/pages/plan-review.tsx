import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { useProjectDocuments } from "@/hooks/use-documents";
import { useParticipants } from "@/hooks/use-participants";
import { MOCK_SHEETS, adaptPlanDocuments, type Sheet } from "./plan-review/plan-review-data";
import { PARTICIPANT_ACTIVE } from "./plan-review/plan-review-types";
import { MarkupToolbar } from "./plan-review/plan-review-toolbar";
import { WorkspaceHeader } from "./plan-review/plan-review-header";
import { SheetPane } from "./plan-review/plan-review-sheet-pane";
import { PlanReviewSplit } from "./plan-review/plan-review-split";
import { useReviewPane } from "./plan-review/use-review-pane";
import { useReviewTools } from "./plan-review/use-review-tools";

/** Project drawing review: one canvas, one tool strip, and persisted comment threads. */
export default function DrawingReviewWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSheetId = searchParams.get("sheet");
  const docsQuery = useProjectDocuments(projectId);
  const sheets = useMemo<Sheet[]>(
    () => (projectId ? adaptPlanDocuments(docsQuery.data ?? [], projectId) : MOCK_SHEETS),
    [projectId, docsQuery.data],
  );
  const tools = useReviewTools();
  const [compareOpen, setCompareOpen] = useState(false);
  const canCompare = sheets.length >= 2;
  const comparing = compareOpen && canCompare;
  const { data: participants = [] } = useParticipants(projectId);
  const assignees = useMemo(
    () =>
      participants
        .filter((p) => p.userId && p.status === PARTICIPANT_ACTIVE)
        .map((p) => ({ id: p.userId!, name: p.name ?? p.email })),
    [participants],
  );
  const context = { sheets, projectId, assignees, tools };
  const review = useReviewPane(context, 0, !comparing);
  const { nav, sheet, activeIndex } = review;

  const appliedRequestedSheet = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedSheetId || appliedRequestedSheet.current === requestedSheetId) return;
    const index = sheets.findIndex((item) => item.id === requestedSheetId);
    if (index < 0) return;
    nav.goTo(index);
    appliedRequestedSheet.current = requestedSheetId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, requestedSheetId]);

  function exitWorkspace(): void {
    if (projectId) navigate(`/project/${projectId}/plans`);
    else if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  }

  if (projectId && docsQuery.isPending)
    return (
      <main className="flex h-dvh items-center justify-center bg-white">
        <Spinner size="md" />
      </main>
    );
  if (projectId && docsQuery.isError)
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-white p-6">
        <p className="text-sm text-gray-600">Could not load this project's plans.</p>
        <Button onClick={() => void docsQuery.refetch()} loading={docsQuery.isFetching}>
          Try again
        </Button>
      </main>
    );
  if (!sheet)
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <FileText size={28} className="text-gray-300" />
        <p className="text-base font-semibold text-gray-900">No plans to review yet</p>
        <p className="text-sm text-gray-500">Upload a drawing to start reviewing it.</p>
        {projectId ? (
          <Link to={`/project/${projectId}/plans`} className="text-sm font-semibold text-primary-600">
            Go to Plans
          </Link>
        ) : null}
      </main>
    );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white font-sans text-gray-900">
      <WorkspaceHeader
        sheets={sheets}
        activeIndex={activeIndex}
        comparing={comparing}
        onSelectSheet={nav.goTo}
        onExit={exitWorkspace}
      />
      <MarkupToolbar
        activeTool={tools.activeTool}
        onSelectTool={tools.setActiveTool}
        markupColor={tools.markupColor}
        onSelectColor={tools.setMarkupColor}
        markupVisible={tools.markupVisible}
        onToggleMarkup={() => tools.setMarkupVisible((visible) => !visible)}
        canCompare={canCompare}
        comparing={comparing}
        onCompare={() => setCompareOpen((open) => !open)}
      />
      {comparing ? <PlanReviewSplit context={context} activeIndex={activeIndex} /> : <SheetPane review={review} />}
    </main>
  );
}
