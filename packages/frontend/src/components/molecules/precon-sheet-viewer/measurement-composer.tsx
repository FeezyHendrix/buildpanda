import { useMemo, useState } from "react";
import { ComboInput } from "@/components/atoms/combo-input";
import { UnitInput } from "@/components/atoms/unit-input";
import { X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { CreateMeasurementBody, MeasureTool, PreconBoqRow, PreconSheet } from "@/api/precon";
import { useCreateMeasurement } from "@/hooks/use-precon";
import { useRateCards } from "@/hooks/use-rate-library";
import { getApiErrorMessage } from "@/lib/api-error";
import { PRECON_TOOL_META, TAKEOFF_SECTIONS } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { MEASURE_DEFAULT_UNIT, formatQty, previewQuantity, unitLabel } from "./measure-maths";

export interface PendingMeasurement {
  tool: MeasureTool;
  vertices: number[][];
  /** Prefilled by Room fill (the room label) and Find symbol ("<name> × <count>"). */
  description?: string;
}

interface Props {
  sessionId: string;
  sheet: PreconSheet;
  pending: PendingMeasurement;
  /** Element groups already in the bill, offered first in the combobox. */
  elementGroups: string[];
  onClose: () => void;
  onCreated: (row: PreconBoqRow) => void;
}

const FIELD = "mt-1 h-9 w-full rounded-lg border-0 bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100";
const LABEL = "block text-xs font-medium text-gray-600";
const STANDARD_GROUPS: string[] = TAKEOFF_SECTIONS.flatMap((section) => [...section.elements]);

function parsePositive(raw: string): number | undefined {
  const value = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Draw first, name after: the drawn shape becomes a verified manual bill line
 * once it has a description, an element group and any factor its tool needs.
 */
export function MeasurementComposer({ sessionId, sheet, pending, elementGroups, onClose, onCreated }: Props) {
  const meta = PRECON_TOOL_META.find((m) => m.measure === pending.tool)!;
  const create = useCreateMeasurement(sessionId);
  const { data: cards = [] } = useRateCards();

  const [description, setDescription] = useState(pending.description ?? "");
  const [elementGroup, setElementGroup] = useState<string | null>(null);
  const [unit, setUnit] = useState(MEASURE_DEFAULT_UNIT[pending.tool]);
  const [code, setCode] = useState("");
  const [factorRaw, setFactorRaw] = useState("");
  const [typicalRaw, setTypicalRaw] = useState("1");
  const [rateRaw, setRateRaw] = useState("");

  const needsHeight = pending.tool === "wall_area";
  const needsDepth = pending.tool === "volume";
  const factorValue = parsePositive(factorRaw);
  const typical = Math.max(1, Math.floor(parsePositive(typicalRaw) ?? 1));
  const rate = parsePositive(rateRaw);

  const groupItems = useMemo(() => [...new Set([...elementGroups, ...STANDARD_GROUPS])], [elementGroups]);
  const rates = useMemo(() => cards.flatMap((card) => card.rates.map((r) => ({ ...r, cardName: card.name }))), [cards]);
  const factor = needsHeight ? { heightM: factorValue } : needsDepth ? { depthM: factorValue } : {};
  const preview = previewQuantity(pending.tool, pending.vertices, sheet.scaleMmPerPt ?? 0, factor, typical);

  const canSubmit = description.trim() !== "" && Boolean(elementGroup?.trim()) && (!(needsHeight || needsDepth) || factorValue !== undefined);

  const submit = () => {
    if (!canSubmit || !elementGroup) return;
    const body: CreateMeasurementBody = {
      sheetId: sheet.id,
      tool: pending.tool,
      vertices: pending.vertices,
      description: description.trim(),
      elementGroup: elementGroup.trim(),
      unit: unit.trim() || undefined,
      code: code.trim() || undefined,
      typical: typical > 1 ? typical : undefined,
      rate,
    };
    if (needsHeight || needsDepth) body.factor = factor;
    create.mutate(body, {
      onSuccess: ({ row }) => {
        toast(`${row.description} added: ${formatQty(row.qty ?? 0)} ${unitLabel(row.unit ?? "")}`, "success");
        onCreated(row);
        onClose();
      },
    });
  };

  const error = create.error ? getApiErrorMessage(create.error, "Could not add the measurement") : null;
  // A floating card, not a modal: the shape just drawn stays visible on the
  // sheet while it is named, and the sheet can still be panned behind it.
  return (
    <form
      className="absolute right-3 top-3 z-20 flex w-[22rem] max-h-[calc(100%-1.5rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">Name this {meta.label.toLowerCase()}</p>
          <p className="text-xs text-gray-500">On {sheet.code ?? sheet.fileName}. It joins the bill as a verified line with the drawn shape as evidence.</p>
        </div>
        <button type="button" aria-label="Discard this shape" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
        {preview ? (
          <>
            <span className="font-semibold tabular-nums">
              {formatQty(preview.gross)} {unitLabel(preview.unit)}
            </span>
            {preview.secondary ? <span className="text-primary-700"> · {preview.secondary}</span> : null}
            {typical > 1 ? <span className="text-primary-700"> · × {typical} typical = {formatQty(preview.qty)} {unitLabel(preview.unit)}</span> : null}
          </>
        ) : needsHeight ? (
          "Enter the wall height to see the area."
        ) : needsDepth ? (
          "Enter the depth to see the volume."
        ) : (
          "Set the sheet scale to see the quantity."
        )}
      </p>

      <label className={LABEL}>
        Description
        <input autoFocus className={FIELD} value={description} placeholder="225 mm blockwork wall" onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label className={LABEL}>
        Element group
        <ComboInput items={groupItems} value={elementGroup} onChange={setElementGroup} placeholder="walls, floor finishes…" emptyText="Keep typing to name a new group." className="mt-1 h-9 px-3" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>
          Unit
          <UnitInput value={unit} onChange={setUnit} className="mt-1 h-9 px-3" />
        </label>
        <label className={LABEL}>
          Work section / code
          <input className={FIELD} value={code} placeholder="optional" onChange={(e) => setCode(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {needsHeight || needsDepth ? (
          <label className={LABEL}>
            {needsHeight ? "Height (m)" : "Depth (m)"}
            <input className={FIELD} inputMode="decimal" value={factorRaw} placeholder={needsHeight ? "2.7" : "0.15"} onChange={(e) => setFactorRaw(e.target.value)} />
          </label>
        ) : null}
        <label className={LABEL}>
          Typical × floors or areas
          <input className={FIELD} inputMode="numeric" value={typicalRaw} onChange={(e) => setTypicalRaw(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>
          From the rate library
          <select
            className={FIELD}
            value=""
            onChange={(e) => {
              const picked = rates.find((r) => r.id === e.target.value);
              if (picked) {
                setRateRaw(String(picked.rate));
                if (picked.unit) setUnit(picked.unit);
              }
            }}
          >
            <option value="">{rates.length === 0 ? "No rates in the library" : "Pick a rate…"}</option>
            {rates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label ?? r.descriptionPattern ?? r.codePrefix ?? r.cardName} · ₦{r.rate.toLocaleString("en-NG")}/{unitLabel(r.unit)}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Rate (₦, optional)
          <input className={FIELD} inputMode="decimal" value={rateRaw} placeholder="unpriced" onChange={(e) => setRateRaw(e.target.value)} />
        </label>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>
          Discard
        </Button>
        <Button type="submit" size="sm" loading={create.isPending} disabled={!canSubmit}>
          Add to bill
        </Button>
      </div>
    </form>
  );
}
MeasurementComposer.displayName = "MeasurementComposer";
