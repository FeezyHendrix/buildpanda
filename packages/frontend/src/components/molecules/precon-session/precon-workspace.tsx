import { useState } from "react";
import { PreconBoqPanel } from "@/components/molecules/precon-boq-panel";
import { PreconSheetViewer, type PreconTool } from "@/components/molecules/precon-sheet-viewer";
import { StructureFields } from "@/components/molecules/precon-session/structure-fields";
import type { PreconSheet, PreconSnapshot } from "@/api/precon";
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
}

interface Props {
  sessionId: string;
  snapshot: PreconSnapshot;
  view: WorkspaceView;
  onSelectSheet: (sheetId: string) => void;
  onSelectRow: (rowId: string | null, sheetId?: string | null) => void;
  onToolChange: (tool: PreconTool) => void;
}

/**
 * The sheet viewer beside the bill panel. An AI take-off reviews here; a hand
 * take-off measures here — same sheets, same bill, same evidence. The
 * structure reading is the engine's, so a hand take-off has none to check.
 */
export function PreconWorkspace({ sessionId, snapshot, view, onSelectSheet, onSelectRow, onToolChange }: Props) {
  const { session } = snapshot;
  const [structureOpen, setStructureOpen] = useState(false);
  const hasDrawings = snapshot.sheets.length > 0;
  const manual = session.takeoffKind === "manual";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {structureOpen ? (
        <StructureFields session={session} onClose={() => setStructureOpen(false)} />
      ) : hasDrawings && !manual ? (
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
          />
        ) : null}
        <PreconBoqPanel sessionId={sessionId} snapshot={snapshot} selectedRowId={view.selectedRowId} onSelectRow={onSelectRow} />
      </div>
    </div>
  );
}
PreconWorkspace.displayName = "PreconWorkspace";
