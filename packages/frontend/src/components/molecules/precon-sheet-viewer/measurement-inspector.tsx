import { useState } from "react";
import { Button } from "@/components/atoms/button";
import type { PreconBoqRow, PreconGeometry, PreconSheet } from "@/api/precon";
import { scaleRatioOf } from "@/lib/precon-meta";
import type { DefinitionConfirmation } from "@/api/precon-editor";
import { formulaParts } from "./polygon-validity";
import { InspectorAssembly } from "./inspector-assembly";
import { InspectorDeductions } from "./inspector-deductions";
import { InspectorRebind } from "./inspector-rebind";
import { InspectorRepeats } from "./inspector-repeats";
import { InspectorLegacy } from "./inspector-legacy";
import { useRowCommands } from "./use-row-commands";

const FIELD = "mt-1 h-8 w-full rounded-md border border-line px-2 text-sm tabular-nums";
const LABEL = "block text-xs font-medium text-gray-600";
// The panel is bounded OUT of the band the floating control dock occupies at the
// foot of the canvas, so it can never sit over Save/Cancel/Undo; on a short pane
// it scrolls instead. The dock wraps to more rows the narrower the canvas gets,
// hence the deeper reserve below sm (three rows) than above it (two).
const INSPECTOR_PANEL =
  "absolute right-3 top-3 z-20 flex max-h-[calc(100%-11rem)] w-72 max-w-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-white p-3 shadow-lg sm:max-h-[calc(100%-7.5rem)]";

interface Definition {
  tool?: string;
  factor?: { heightM?: number; depthM?: number };
  scale?: import("@/api/precon-row-types").ScaleBinding;
}

function definitionOf(row: PreconBoqRow): Definition | null {
  const raw = row.measurementDefinition;
  return raw && typeof raw === "object" ? (raw as Definition) : null;
}

interface Props {
  sessionId: string;
  row: PreconBoqRow;
  sheet: PreconSheet | null;
  /** The row's measuring geometries on the ACTIVE sheet — each carries its own definition. */
  rowGeometries: PreconGeometry[];
  /** Also held for the next shape save, which may carry the same confirmation. */
  onLegacyConfirm: (confirmation: DefinitionConfirmation) => void;
  legacyConfirmed: DefinitionConfirmation | null;
}

/**
 * The selected line's measurement properties: the recorded basis read-only,
 * `(gross − deductions) × N` always parenthesised, height/depth edited
 * WITHOUT redrawing, whole-number typical, and named cutouts. Every write is
 * one operation-envelope command; a refusal keeps the typed inputs.
 */
export function MeasurementInspector({ sessionId, row, sheet, rowGeometries, onLegacyConfirm, legacyConfirmed }: Props) {
  const commands = useRowCommands(sessionId);
  const definition = definitionOf(row);
  const tool = definition?.tool ?? legacyConfirmed?.tool ?? null;
  // Legacy = a shape with NO recorded basis. Per-geometry now: the confirm
  // targets exactly the shape that lacks a definition, never a guess.
  const unknownShape = rowGeometries.find((g) => !g.definition) ?? null;
  const assemblyShape = rowGeometries.find((g) => g.definition?.assembly) ?? null;
  const isLegacy = definition === null || unknownShape !== null;
  const [heightRaw, setHeightRaw] = useState(definition?.factor?.heightM !== undefined ? String(definition.factor.heightM) : "");
  const [depthRaw, setDepthRaw] = useState(definition?.factor?.depthM !== undefined ? String(definition.factor.depthM) : "");
  const [typicalRaw, setTypicalRaw] = useState(String(row.typical ?? 1));
  const [typicalError, setTypicalError] = useState<string | null>(null);

  const typical = row.typical ?? 1;
  const deducted = row.deductions.reduce((sum, d) => sum + d.qty, 0);
  const heightValue = Number(heightRaw);
  const depthValue = Number(depthRaw);

  const applyTypical = () => {
    const value = Number(typicalRaw);
    if (!Number.isInteger(value) || value < 1) {
      setTypicalError("Typical must be a whole number of repetitions (1 or more); nothing was sent.");
      return;
    }
    setTypicalError(null);
    commands.setTypical(row, value);
  };

  return (
    <div
      className={INSPECTOR_PANEL}
      data-inspector
      role="region"
      aria-label={`Measurement properties — ${row.description}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <p className="truncate text-sm font-semibold text-gray-900">{row.description}</p>
        <p className="text-xs text-gray-500">
          {tool ?? "Legacy · basis unconfirmed"} · {row.unit ?? "no unit"}
          {sheet?.scaleMmPerPt ? ` · 1:${scaleRatioOf(sheet.scaleMmPerPt)}` : " · no sheet scale"}
          <span data-row-version> · v{row.version}</span>
        </p>
        {row.measurementBasis ? <p className="mt-0.5 text-xs text-gray-500" data-basis>{row.measurementBasis}</p> : null}
      </div>

      {assemblyShape?.definition?.assembly ? (
        <InspectorAssembly assembly={assemblyShape.definition.assembly} base={{ quantity: assemblyShape.quantity, unit: assemblyShape.unit }} />
      ) : null}

      <p className="rounded-md bg-primary-50 px-2 py-1.5 text-sm font-semibold tabular-nums text-primary-800" data-formula>
        {formulaParts({ gross: row.qtyGross, deductions: deducted, typical, net: row.qty, unit: row.unit })}
      </p>

      {isLegacy ? (
        <InspectorLegacy
          confirmed={legacyConfirmed}
          viewports={sheet?.viewports ?? []}
          onConfirm={(confirmation, scaleChoice) => {
            onLegacyConfirm(confirmation);
            if (unknownShape) commands.confirmBasis(row, unknownShape.id, confirmation, scaleChoice);
          }}
        />
      ) : null}

      {tool === "wall_area" ? (
        <div className="flex items-end gap-2">
          <label className={`${LABEL} flex-1`}>
            Wall height (m) — re-measures without redrawing
            <input aria-label="Wall height in metres" className={FIELD} value={heightRaw} onChange={(e) => setHeightRaw(e.target.value)} />
          </label>
          <Button size="sm" loading={commands.saving} disabled={!Number.isFinite(heightValue) || heightValue <= 0} title={heightValue <= 0 ? "Height must be greater than zero" : undefined} onClick={() => commands.setFactor(row, { heightM: heightValue })}>
            Apply
          </Button>
        </div>
      ) : null}
      {tool === "volume" ? (
        <div className="flex items-end gap-2">
          <label className={`${LABEL} flex-1`}>
            Depth (m) — re-measures without redrawing
            <input aria-label="Depth in metres" className={FIELD} value={depthRaw} onChange={(e) => setDepthRaw(e.target.value)} />
          </label>
          <Button size="sm" loading={commands.saving} disabled={!Number.isFinite(depthValue) || depthValue <= 0} title={depthValue <= 0 ? "Depth must be greater than zero" : undefined} onClick={() => commands.setFactor(row, { depthM: depthValue })}>
            Apply
          </Button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <label className={`${LABEL} flex-1`}>
          Typical × N (whole floors or areas)
          <input aria-label="Typical repetitions" className={FIELD} value={typicalRaw} onChange={(e) => setTypicalRaw(e.target.value)} />
        </label>
        <Button size="sm" loading={commands.saving} onClick={applyTypical}>
          Apply
        </Button>
      </div>
      {typicalError ? <p className="text-xs text-red-600" data-typical-error>{typicalError}</p> : null}

      {rowGeometries.map((g, i) =>
        g.definition?.scale && g.definition.tool !== "count" ? (
          <div key={g.id} data-rebind-shape={g.id}>
            {rowGeometries.length > 1 ? (
              <p className="text-xs font-semibold text-gray-700">
                Shape {i + 1} of {rowGeometries.length} · {g.definition.tool}
              </p>
            ) : null}
            <InspectorRebind row={row} sheet={sheet} geometryId={g.id} binding={g.definition.scale} commands={commands} />
          </div>
        ) : null,
      )}
      <InspectorRepeats row={row} commands={commands} />

      <InspectorDeductions row={row} parentTool={tool ?? "area"} commands={commands} />

      {commands.error ? <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700" data-inspector-error>{commands.error}</p> : null}
    </div>
  );
}
MeasurementInspector.displayName = "MeasurementInspector";
