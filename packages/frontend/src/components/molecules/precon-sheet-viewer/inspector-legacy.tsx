import { useState } from "react";
import { Button } from "@/components/atoms/button";
import type { DefinitionConfirmation, ScaleChoice } from "@/api/precon-editor";
import type { MeasureTool, SheetViewport } from "@/api/precon";
import { MEASURE_DEFAULT_UNIT } from "./measure-maths";

const TOOL_CHOICES: { key: MeasureTool; label: string }[] = [
  { key: "length", label: "Length" },
  { key: "polyline", label: "Polyline" },
  { key: "area", label: "Area" },
  { key: "count", label: "Count" },
  { key: "volume", label: "Volume" },
  { key: "wall_area", label: "Wall area" },
];

const FIELD = "mt-1 h-8 w-full rounded-md border border-line px-2 text-sm";
const LABEL = "block text-xs font-medium text-gray-600";

interface Props {
  confirmed: DefinitionConfirmation | null;
  /** The sheet's scale regions: the stated basis names one explicitly, or the sheet scale. */
  viewports: SheetViewport[];
  onConfirm: (confirmation: DefinitionConfirmation, scaleChoice: ScaleChoice) => void;
}

/**
 * A legacy line recorded no measurement basis. Nothing here is guessed or
 * parsed from prose (contract 3): the QS states the tool, unit and factor
 * explicitly, and quantity edits stay blocked until they do.
 */
export function InspectorLegacy({ confirmed, viewports, onConfirm }: Props) {
  const [region, setRegion] = useState("sheet");
  const [tool, setTool] = useState<MeasureTool>(confirmed?.tool ?? "area");
  const [unit, setUnit] = useState(confirmed?.unit ?? "");
  const [factorRaw, setFactorRaw] = useState(
    confirmed?.factor?.heightM !== undefined ? String(confirmed.factor.heightM) : confirmed?.factor?.depthM !== undefined ? String(confirmed.factor.depthM) : "",
  );
  const needsHeight = tool === "wall_area";
  const needsDepth = tool === "volume";
  const factorValue = Number(factorRaw);
  const factorOk = !(needsHeight || needsDepth) || (Number.isFinite(factorValue) && factorValue > 0);
  const canConfirm = unit.trim() !== "" && factorOk;

  if (confirmed) {
    return (
      <p className="rounded-md bg-primary-50 px-2 py-1.5 text-xs text-primary-800" data-legacy-confirmed>
        Basis confirmed for this edit: {confirmed.tool} · {confirmed.unit}
        {confirmed.factor?.heightM ? ` · height ${confirmed.factor.heightM} m` : ""}
        {confirmed.factor?.depthM ? ` · depth ${confirmed.factor.depthM} m` : ""}
      </p>
    );
  }
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-2" data-legacy-confirm>
      <p className="text-xs font-semibold text-amber-800">Legacy line — no recorded basis</p>
      <p className="mt-0.5 text-xs text-amber-700">Confirm how it was measured before its quantity can change. Nothing is assumed.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className={LABEL}>
          Measured as
          <select aria-label="Legacy tool" className={FIELD} value={tool} onChange={(e) => setTool(e.target.value as MeasureTool)}>
            {TOOL_CHOICES.map((choice) => (
              <option key={choice.key} value={choice.key}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Unit
          <input aria-label="Legacy unit" className={FIELD} value={unit} placeholder={MEASURE_DEFAULT_UNIT[tool]} onChange={(e) => setUnit(e.target.value)} />
        </label>
      </div>
      {viewports.length > 0 ? (
        <label className={`${LABEL} mt-2`}>
          Measured against
          <select aria-label="Legacy scale region" className={FIELD} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="sheet">The sheet scale</option>
            {viewports.map((viewport) => (
              <option key={viewport.id} value={viewport.id}>
                Region {viewport.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {needsHeight || needsDepth ? (
        <label className={`${LABEL} mt-2`}>
          {needsHeight ? "Wall height (m)" : "Depth (m)"}
          <input aria-label="Legacy factor" className={FIELD} value={factorRaw} onChange={(e) => setFactorRaw(e.target.value)} />
        </label>
      ) : null}
      <Button
        size="sm"
        className="mt-2"
        disabled={!canConfirm}
        onClick={() =>
          onConfirm(
            {
              tool,
              unit: unit.trim(),
              ...(needsHeight ? { factor: { heightM: factorValue } } : needsDepth ? { factor: { depthM: factorValue } } : {}),
            },
            region === "sheet" ? { source: "sheet" } : { source: "viewport", viewportId: region },
          )
        }
      >
        Confirm basis
      </Button>
    </div>
  );
}
InspectorLegacy.displayName = "InspectorLegacy";
