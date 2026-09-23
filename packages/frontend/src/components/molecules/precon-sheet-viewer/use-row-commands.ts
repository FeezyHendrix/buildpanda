import { useState } from "react";
import type { PreconBoqRow } from "@/api/precon";
import type { DeductionMode, DefinitionConfirmation, ScaleChoice } from "@/api/precon-editor";
import { getApiErrorMessage } from "@/lib/api-error";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";

export interface DeductionDimensions {
  widthM?: number;
  heightM?: number;
  depthM?: number;
}

/**
 * The inspector's row-level writes, all through the operation envelope: a
 * storey height or slab depth without redrawing, the typical multiplier, and
 * named stated cutouts. Every failure keeps the user's inputs (component
 * state) and surfaces the server's actual message.
 */
export function useRowCommands(sessionId: string) {
  const operation = useEditorOperation(sessionId);
  const [error, setError] = useState<string | null>(null);

  const send = (row: PreconBoqRow, command: Parameters<typeof operation.mutate>[0]["command"], onDone?: () => void) => {
    setError(null);
    operation.mutate(
      { operationId: newOperationId(), expectedRows: [{ id: row.id, version: row.version }], command },
      {
        onSuccess: () => onDone?.(),
        onError: (err) => setError(getApiErrorMessage(err, "The change was refused; your inputs are kept.")),
      },
    );
  };

  return {
    error,
    clearError: () => setError(null),
    saving: operation.isPending,
    setFactor: (row: PreconBoqRow, factor: { heightM?: number; depthM?: number }, onDone?: () => void) =>
      send(row, { kind: "set-row-factor", rowId: row.id, ...factor }, onDone),
    setTypical: (row: PreconBoqRow, typical: number, onDone?: () => void) =>
      send(row, { kind: "set-row-typical", rowId: row.id, typical }, onDone),
    addDeduction: (row: PreconBoqRow, input: { label: string; mode: DeductionMode; dimensions: DeductionDimensions }, onDone?: () => void) =>
      send(row, { kind: "add-deduction", rowId: row.id, ...input }, onDone),
    editDeduction: (row: PreconBoqRow, geometryId: string, dimensions: DeductionDimensions, onDone?: () => void) =>
      send(row, { kind: "edit-deduction", rowId: row.id, geometryId, dimensions }, onDone),
    removeDeduction: (row: PreconBoqRow, geometryId: string, onDone?: () => void) =>
      send(row, { kind: "remove-deduction", rowId: row.id, geometryId }, onDone),
    /**
     * Re-enter a STATED legacy opening (no drawn shape, no geometry id) as
     * typed numbers. The target is positional, so the row version AND the
     * exact current entry are both pinned; the unit is confirmed explicitly.
     */
    editStatedDeduction: (
      row: PreconBoqRow,
      target: { index: number; expect: { label: string; qty: number; unit: string | null } },
      input: { label?: string; qty: number; unit: string },
      onDone?: () => void,
    ) =>
      send(
        row,
        { kind: "edit-stated-deduction", rowId: row.id, rowVersion: row.version, index: target.index, expect: target.expect, ...input, unitConfirmed: true },
        onDone,
      ),
    removeStatedDeduction: (
      row: PreconBoqRow,
      target: { index: number; expect: { label: string; qty: number; unit: string | null } },
      onDone?: () => void,
    ) => send(row, { kind: "remove-stated-deduction", rowId: row.id, rowVersion: row.version, index: target.index, expect: target.expect }, onDone),
    setRepeatLabels: (row: PreconBoqRow, repeatLabels: string[], onDone?: () => void) =>
      send(row, { kind: "set-measurement-settings", rowId: row.id, repeatLabels }, onDone),
    splitRepeatException: (row: PreconBoqRow, label: string, onDone?: () => void) =>
      send(row, { kind: "split-repeat-exception", rowId: row.id, label, confirmed: true }, onDone),
    /** CHANGE a recorded scale binding: the figure moves, openings re-cut, review returns. */
    rebindGeometry: (row: PreconBoqRow, geometryId: string, scaleChoice: { source: "sheet" } | { source: "viewport"; viewportId: string }, onDone?: () => void) =>
      send(row, { kind: "rebind-geometry", geometryId, scaleChoice }, onDone),
    /** Persist a legacy line's stated basis as its own receipt (contract 22). */
    confirmBasis: (row: PreconBoqRow, geometryId: string, confirmation: DefinitionConfirmation, scaleChoice: ScaleChoice, onDone?: () => void) =>
      send(row, { kind: "confirm-measurement-basis", rowId: row.id, geometryId, tool: confirmation.tool, unit: confirmation.unit, scaleChoice, ...(confirmation.factor ? { factor: confirmation.factor } : {}) }, onDone),
  };
}
