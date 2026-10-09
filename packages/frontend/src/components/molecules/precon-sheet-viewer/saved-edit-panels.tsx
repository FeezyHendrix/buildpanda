import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import type { SavedEditConflict, SavedEditState } from "./use-saved-edit";

const PANEL = "absolute left-3 top-3 z-20 w-64 rounded-lg border border-line bg-white p-3 shadow-lg";
const LABEL = "block text-xs font-medium text-gray-600";
const FIELD = "mt-1 h-8 w-full rounded-md border border-line px-2 text-sm tabular-nums";

interface VertexPanelProps {
  edit: SavedEditState;
  /** Null on an unscaled sheet: the metres-based extend is then disabled with the reason. */
  mmPerPt: number | null;
  onMoveSelectedTo: (x: number, y: number) => void;
  onExtendBy: (lengthM: number, angleDeg: number) => void;
}

/**
 * The no-drag alternatives: exact X/Y (sheet points) for the selected vertex,
 * and length (m) + angle (°) to place the next point from the run's end.
 */
export function VertexInputsPanel({ edit, mmPerPt, onMoveSelectedTo, onExtendBy }: VertexPanelProps) {
  const selected = edit.selectedVertex !== null ? edit.vertices[edit.selectedVertex] : null;
  const [x, setX] = useState(selected ? String(Math.round(selected[0]! * 100) / 100) : "");
  const [y, setY] = useState(selected ? String(Math.round(selected[1]! * 100) / 100) : "");
  const [lengthM, setLengthM] = useState("");
  const [angleDeg, setAngleDeg] = useState("0");
  const xN = Number(x);
  const yN = Number(y);
  const lenN = Number(lengthM);
  const angN = Number(angleDeg);
  const canExtend = edit.kind === "linear" && (edit.addingAt !== null || edit.selectedVertex === 0 || edit.selectedVertex === edit.vertices.length - 1);
  return (
    <div className={PANEL} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {selected ? (
        <div>
          <p className="text-xs font-semibold text-gray-900">Point {edit.selectedVertex! + 1} — exact position (sheet pt)</p>
          <div className="mt-1 grid grid-cols-3 items-end gap-2">
            <label className={LABEL}>
              X<input aria-label="Vertex X (sheet points)" className={FIELD} value={x} onChange={(e) => setX(e.target.value)} />
            </label>
            <label className={LABEL}>
              Y<input aria-label="Vertex Y (sheet points)" className={FIELD} value={y} onChange={(e) => setY(e.target.value)} />
            </label>
            <Button size="sm" variant="secondary" disabled={!Number.isFinite(xN) || !Number.isFinite(yN)} onClick={() => onMoveSelectedTo(xN, yN)}>
              Place
            </Button>
          </div>
        </div>
      ) : null}
      {canExtend ? (
        <div className={cn(selected && "mt-3 border-t border-line-hair pt-2")}>
          <p className="text-xs font-semibold text-gray-900">
            Extend from the {edit.addingAt === "start" || edit.selectedVertex === 0 ? "start" : "end"}
          </p>
          <div className="mt-1 grid grid-cols-3 items-end gap-2">
            <label className={LABEL}>
              Length (m)
              <input aria-label="Extend length in metres" className={FIELD} value={lengthM} placeholder="2.5" onChange={(e) => setLengthM(e.target.value)} />
            </label>
            <label className={LABEL}>
              Angle (°)
              <input aria-label="Extend angle in degrees" className={FIELD} value={angleDeg} onChange={(e) => setAngleDeg(e.target.value)} />
            </label>
            <Button
              size="sm"
              variant="secondary"
              title={mmPerPt ? "Add a point this far from the anchored end" : "This sheet has no scale"}
              disabled={!mmPerPt || !Number.isFinite(lenN) || lenN <= 0 || !Number.isFinite(angN)}
              onClick={() => onExtendBy(lenN, angN)}
            >
              Add
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
VertexInputsPanel.displayName = "VertexInputsPanel";

interface ConflictPanelProps {
  conflict: SavedEditConflict;
  localVertexCount: number;
  onReapply: () => void;
  onDiscard: () => void;
  reapplying: boolean;
}

/** The 409 outcome: the server's line and the unsaved local shape, side by side, resolved only explicitly. */
export function ConflictPanel({ conflict, localVertexCount, onReapply, onDiscard, reapplying }: ConflictPanelProps) {
  // A version of -1 means the snapshot no longer carries the row at all: there
  // is nothing to reapply ONTO, so only discarding is offered.
  const rowGone = conflict.serverVersion <= 0;
  return (
    <div className={cn(PANEL, "w-80 border-amber-200")} data-conflict-panel role="alertdialog" aria-label="This line changed while you edited it" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <p className="text-sm font-semibold text-gray-900">This line changed while you edited it</p>
      <p className="mt-1 text-xs text-gray-600">{conflict.message}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-amber-50 p-2 text-xs">
        <dt className="text-gray-500">You started from</dt>
        <dd className="text-right tabular-nums text-gray-900" data-conflict-base>
          {conflict.baseVersion === null ? "—" : `v${conflict.baseVersion}`}
        </dd>
        <dt className="text-gray-500">On the server now</dt>
        <dd className="text-right tabular-nums text-gray-900" data-conflict-server>
          {rowGone ? "deleted" : `${conflict.serverQty ?? "—"} · v${conflict.serverVersion} · ${conflict.serverStatus ?? "—"}`}
        </dd>
        <dt className="text-gray-500">Your unsaved shape</dt>
        <dd className="text-right tabular-nums text-gray-900">{localVertexCount} points (dashed on the sheet)</dd>
      </dl>
      <p className="mt-2 text-xs text-gray-600">
        {rowGone
          ? "That line is no longer on the bill, so this edit cannot be reapplied."
          : "Reapply sends the same change on the version above. Nothing is sent until you choose."}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDiscard}>
          Discard my edit
        </Button>
        {rowGone ? null : (
          <Button size="sm" loading={reapplying} onClick={onReapply}>
            Reapply on v{conflict.serverVersion}
          </Button>
        )}
      </div>
    </div>
  );
}
ConflictPanel.displayName = "ConflictPanel";
