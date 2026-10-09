import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import { BASIS_LABELS, SOURCE_ACTION_LABELS, type FocusedBinding, type SourceAction } from "./source-action";
import type { CellFocus } from "./univer-engine";

const A1_ALPHABET = 26;

export function columnLetter(index: number): string {
  let remaining = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (remaining % A1_ALPHABET)) + letters;
    remaining = Math.floor(remaining / A1_ALPHABET) - 1;
  } while (remaining >= 0);
  return letters;
}

const BASIS_TONE = {
  measured: "success",
  legacy: "warning",
  stated: "neutral",
  narrative: "neutral",
} as const;

interface Props {
  focus: CellFocus | null;
  sheetLabel: string;
  binding: FocusedBinding | null;
  action: SourceAction;
  /** True on a narrow viewport, where this IS how a cell is edited. */
  docked: boolean;
  onCommit: (text: string) => void;
  onSourceAction: (action: SourceAction) => void;
}

/**
 * The focused cell, its formula, and what may be done about where its figure
 * came from.
 *
 * On a phone this is not a convenience: the native cell editor is unusable at
 * 375px with a keyboard covering two thirds of the screen, so the workbook
 * keeps its full formula capability HERE rather than degrading to a read-only
 * list. The grid stays behind it, scrollable, showing the same cell selected.
 */
export function CellInspector({
  focus,
  sheetLabel,
  binding,
  action,
  docked,
  onCommit,
  onSourceAction,
}: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const address = focus ? `${columnLetter(focus.column)}${focus.row + 1}` : null;

  // Follow the selection, but never overwrite what is being typed: the user
  // moving the cursor is a new cell, the user typing is the same one.
  useEffect(() => {
    if (editing) return;
    setDraft(focus ? (focus.formula || focus.value) : "");
  }, [focus?.sheetId, focus?.row, focus?.column, focus?.formula, focus?.value, editing]);

  const commit = (): void => {
    setEditing(false);
    if (focus && draft !== (focus.formula || focus.value)) onCommit(draft);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-line bg-surface px-3 py-2",
        // In normal flow, below the grid — NOT `fixed`. A fixed bar overlays the
        // last rows, and a spreadsheet you cannot see the bottom of is worse
        // than one whose editor you scroll to.
        docked ? "shrink-0 border-t" : "border-b",
      )}
      data-cell-inspector
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-semibold text-black-300">
          {address ? `${sheetLabel} · ${address}` : "No cell selected"}
        </span>
        {binding ? (
          <Badge size="sm" tone={BASIS_TONE[binding.binding.basis]}>
            {BASIS_LABELS[binding.binding.basis]}
          </Badge>
        ) : null}
        {focus && !focus.editable ? (
          <span className="text-[11px] text-ink-muted">Generated from the bill</span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="workbook-cell-editor">
          Value or formula for the selected cell
        </label>
        <input
          id="workbook-cell-editor"
          ref={input}
          className={cn(INPUT_SM_CLASS, "flex-1 font-mono text-[13px]")}
          value={draft}
          disabled={!focus?.editable}
          placeholder={focus?.editable ? "Type a value, or = to start a formula" : "This cell comes from the drawings"}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setEditing(true)}
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
              input.current?.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
              setDraft(focus ? (focus.formula || focus.value) : "");
              input.current?.blur();
            }
          }}
        />
        {action.kind !== "none" ? (
          <Button size="sm" variant="secondary" className="shrink-0" onClick={() => onSourceAction(action)}>
            {SOURCE_ACTION_LABELS[action.kind]}
          </Button>
        ) : null}
      </div>

      {action.kind === "none" && binding === null ? (
        <p className="text-[11px] text-ink-muted">{action.reason}</p>
      ) : null}
      {action.kind === "none" && binding !== null ? (
        <p className="text-[11px] text-ink-muted">{action.reason}</p>
      ) : null}
      {action.kind === "remeasure" && action.geometryIds.length > 1 ? (
        <p className="text-[11px] text-ink-muted">
          {action.geometryIds.length} measurements feed this figure — you will be asked which one.
        </p>
      ) : null}
    </div>
  );
}
CellInspector.displayName = "CellInspector";
