import { useCallback, useEffect, useRef, useState } from "react";
import { PreconBoqPanel } from "@/components/molecules/precon-boq-panel";
import { PreconSheetViewer, type PreconTool } from "@/components/molecules/precon-sheet-viewer";
import { PreconWorkbook, type SourceAction } from "@/components/molecules/precon-workbook";
import { StaleRevisionBanner } from "@/components/molecules/precon-session/stale-revision-banner";
import { StructureFields } from "@/components/molecules/precon-session/structure-fields";
import { WorkspaceModeControl } from "@/components/molecules/precon-session/workspace-mode-control";
import {
  canSplit,
  COMPACT_WORKBOOK_WIDTH,
  PANE_GAP,
  resolveMode,
  type CollapsePreference,
  type WorkspaceMode,
} from "@/components/molecules/precon-session/workspace-mode";
import type { PreconSheet, PreconSnapshot } from "@/api/precon";
import { usePreconFocus } from "@/hooks/use-precon";
import { cn } from "@/lib/utils";

export interface ZoomRequest {
  seq: number;
  kind: "in" | "out" | "fit";
}

/** What the page owns about the viewer: which sheet, which row, which tool. */
export interface WorkspaceView {
  sheets: PreconSheet[];
  activeSheet: PreconSheet | null;
  selectedRowId: string | null;
  tool: PreconTool;
  zoomRequest: ZoomRequest | null;
  /** Which annotation the source chooser settled on, if any. */
  focusGeometry: { seq: number; geometryId: string } | null;
  mode: WorkspaceMode;
  /** Which pane wins when Split is asked for but will not fit. */
  collapseTo: CollapsePreference;
}

interface Props {
  sessionId: string;
  snapshot: PreconSnapshot;
  view: WorkspaceView;
  onSelectSheet: (sheetId: string) => void;
  onSelectRow: (rowId: string | null, sheetId?: string | null) => void;
  onToolChange: (tool: PreconTool) => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onSourceAction: (action: SourceAction) => void;
}

/**
 * The workbook, the sheet viewer and the bill panel, and the control that says
 * which of them has the screen.
 *
 * Both panes stay MOUNTED whichever is showing. Hiding rather than unmounting
 * is what lets a person jump to the drawing a figure came from and come back to
 * a half-typed formula, a zoom level and a scroll position that are all still
 * there — and it is why the hidden pane is `hidden` rather than absent from the
 * tree.
 */
export function PreconWorkspace({
  sessionId,
  snapshot,
  view,
  onSelectSheet,
  onSelectRow,
  onToolChange,
  onModeChange,
  onSourceAction,
}: Props) {
  const { session } = snapshot;
  const [structureOpen, setStructureOpen] = useState(false);
  const [workbookFocused, setWorkbookFocused] = useState(false);
  const [frameWidth, setFrameWidth] = useState(0);
  const frame = useRef<HTMLDivElement | null>(null);

  const hasDrawings = snapshot.sheets.length > 0;
  const manual = session.takeoffKind === "manual";
  usePreconFocus(sessionId, view.selectedRowId);

  // ONE mode-independent measurement, of the workspace container. Measuring
  // the pane row instead shrinks it while the bill panel is up, refusing a
  // split that would fit precisely because splitting removes that panel.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFrameWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    setFrameWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const resolved = resolveMode(view.mode, frameWidth, hasDrawings, view.collapseTo);
  // The bill panel is the DRAWING's companion. Beside a spreadsheet rendering
  // the same bill it is a redundant copy whose fixed 420px squeezed the grid.
  const showBill = resolved.showDrawings && !resolved.showWorkbook;
  // Derived from the same single measurement: the workbook has the whole
  // workspace to itself, or half of it in a split.
  const workbookPaneWidth = resolved.showDrawings ? (frameWidth - PANE_GAP) / 2 : frameWidth;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" ref={frame}>
      {session.stale && !session.supersededBy ? <StaleRevisionBanner session={session} /> : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {hasDrawings ? (
          <WorkspaceModeControl mode={view.mode} splitAvailable={canSplit(frameWidth)} onChange={onModeChange} />
        ) : null}
        {resolved.splitCollapsed ? (
          <span className="text-[11px] leading-snug text-ink-muted">
            Not enough room for both panes — showing the {resolved.showWorkbook ? "workbook" : "drawing"}.
          </span>
        ) : null}
        {structureOpen ? null : hasDrawings && !manual ? (
          <button
            type="button"
            onClick={() => setStructureOpen(true)}
            className="text-xs font-medium text-primary-600 hover:underline sm:ml-auto"
          >
            {session.structureContext?.confidence === "high"
              ? "Structure reading confirmed · edit"
              : "Check the structure reading Panda AI used"}
          </button>
        ) : null}
      </div>
      {structureOpen ? <StructureFields session={session} onClose={() => setStructureOpen(false)} /> : null}

      {/* Below lg the panes cannot share one viewport height without collapsing
          to unusable strips, so they stack in a scrolling column and each keeps
          a height it can actually be worked in. */}
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-4",
          showBill && "max-lg:auto-rows-min max-lg:overflow-y-auto lg:grid-cols-[1fr_420px]",
        )}
      >
        <div
          className={cn(
            "grid min-h-0 min-w-0 gap-4",
            resolved.showWorkbook && resolved.showDrawings
              ? "max-lg:auto-rows-min max-lg:overflow-y-auto lg:grid-cols-2"
              : "grid-cols-1",
          )}
        >
          {hasDrawings ? (
            <div className={cn("flex min-h-0 min-w-0 flex-col", !resolved.showDrawings && "hidden")}>
              <PreconSheetViewer
                sessionId={sessionId}
                sheets={view.sheets}
                activeSheet={view.activeSheet}
                onSelectSheet={onSelectSheet}
                geometries={snapshot.geometries}
                rows={snapshot.rows}
                selectedRowId={view.selectedRowId}
                onSelectRow={onSelectRow}
                tool={view.tool}
                onToolChange={onToolChange}
                zoomRequest={view.zoomRequest}
                focusGeometry={view.focusGeometry}
                shortcutsEnabled={!workbookFocused}
              />
            </div>
          ) : null}

          <div className={cn("flex min-h-0 min-w-0 flex-col", !resolved.showWorkbook && "hidden")}>
            <PreconWorkbook
              sessionId={sessionId}
              active={resolved.showWorkbook}
              compact={workbookPaneWidth < COMPACT_WORKBOOK_WIDTH}
              onSourceAction={onSourceAction}
              onFocusWithin={useCallback((focused: boolean) => setWorkbookFocused(focused), [])}
            />
          </div>
        </div>

        {/* Kept mounted so its queries, scroll position and any open row detail
            survive a trip through the workbook. */}
        <div className={cn("flex min-h-0 min-w-0 flex-col", !showBill && "hidden")}>
          <PreconBoqPanel
            sessionId={sessionId}
            snapshot={snapshot}
            selectedRowId={view.selectedRowId}
            onSelectRow={onSelectRow}
          />
        </div>
      </div>
    </div>
  );
}
PreconWorkspace.displayName = "PreconWorkspace";
