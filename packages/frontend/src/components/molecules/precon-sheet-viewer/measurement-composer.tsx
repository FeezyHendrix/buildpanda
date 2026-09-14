import { useMemo, useState } from "react";
import { ComboInput } from "@/components/atoms/combo-input";
import { UnitInput } from "@/components/atoms/unit-input";
import { X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { Assembly, CreateMeasurementBody, MeasureTool, PreconBoqRow, PreconSheet } from "@/api/precon";
import { useAssemblies, useCreateAssemblyMeasurement, useCreateMeasurement } from "@/hooks/use-precon";
import { useRateCards } from "@/hooks/use-rate-library";
import { getApiErrorMessage } from "@/lib/api-error";
import { PRECON_TOOL_META, TAKEOFF_SECTIONS } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { MEASURE_DEFAULT_UNIT, formatQty, previewQuantity, unitLabel } from "./measure-maths";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

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

const FIELD = cn(INPUT_SM_CLASS, "mt-1");
const LABEL = "block text-xs font-medium text-gray-600";
const STANDARD_GROUPS: string[] = TAKEOFF_SECTIONS.flatMap((section) => [...section.elements]);

function parsePositive(raw: string): number | undefined {
  const value = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** WS-M3B: what one drawn quantity becomes when an assembly names the lines. */
function AssemblyItemsPreview({ assembly, gross }: { assembly: Assembly; gross: number | null }) {
  return (
    <ul className="divide-y divide-line-hair rounded-lg border border-line text-xs">
      {assembly.items.map((item, index) => (
        <li key={`${item.description}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="min-w-0 truncate text-gray-800">
            {item.description}
            {item.code ? <span className="ml-1 font-mono text-[10px] text-gray-400">{item.code}</span> : null}
          </span>
          <span className="shrink-0 tabular-nums text-gray-500">
            × {item.factor}
            {gross !== null ? ` = ${formatQty(gross * item.factor)} ${unitLabel(item.unit)}` : ` ${unitLabel(item.unit)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
AssemblyItemsPreview.displayName = "AssemblyItemsPreview";

/**
 * Draw first, name after: the drawn shape becomes a verified manual bill line
 * once it has a description, an element group and any factor its tool needs.
 */
export function MeasurementComposer({ sessionId, sheet, pending, elementGroups, onClose, onCreated }: Props) {
  const meta = PRECON_TOOL_META.find((m) => m.measure === pending.tool)!;
  const create = useCreateMeasurement(sessionId);
  const createFromAssembly = useCreateAssemblyMeasurement(sessionId);
  const { data: cards = [] } = useRateCards();
  const { data: assemblies = [] } = useAssemblies();

  // WS-M3B: an assembly names the lines itself, so description and unit go away
  const [assemblyId, setAssemblyId] = useState(pending.description ?? "");
  const assembly = assemblies.find((a) => a.id === assemblyId) ?? null;
  const [description, setDescription] = useState("");
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

  const effectiveGroup = elementGroup?.trim() || assembly?.elementGroup || "";
  const canSubmit =
    (assembly !== null || description.trim() !== "") && effectiveGroup !== "" && (!(needsHeight || needsDepth) || factorValue !== undefined);

  const submitAssembly = (picked: Assembly) => {
    createFromAssembly.mutate(
      {
        assemblyId: picked.id,
        sheetId: sheet.id,
        tool: pending.tool,
        vertices: pending.vertices,
        elementGroup: effectiveGroup,
        code: code.trim() || undefined,
        typical: typical > 1 ? typical : undefined,
        ...(needsHeight || needsDepth ? { factor } : {}),
      },
      {
        onSuccess: ({ rows }) => {
          toast(`${picked.name}: ${rows.length} line${rows.length === 1 ? "" : "s"} added to the bill`, "success");
          if (rows[0]) onCreated(rows[0]);
          onClose();
        },
      },
    );
  };

  const submit = () => {
    if (!canSubmit) return;
    if (assembly) return submitAssembly(assembly);
    if (!elementGroup) return;
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

  const activeError = create.error ?? createFromAssembly.error;
  const error = activeError ? getApiErrorMessage(activeError, "Could not add the measurement") : null;
  const submitting = create.isPending || createFromAssembly.isPending;
  // A floating card, not a modal: the shape just drawn stays visible on the
  // sheet while it is named, and the sheet can still be panned behind it.
  return (
    <form
      className="absolute right-3 top-3 z-20 flex w-[22rem] max-h-[calc(100%-1.5rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-lg"
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
        From an assembly
        <select
          className={FIELD}
          value={assemblyId}
          onChange={(e) => {
            setAssemblyId(e.target.value);
            const picked = assemblies.find((a) => a.id === e.target.value);
            if (picked && !elementGroup) setElementGroup(picked.elementGroup);
          }}
        >
          <option value="">{assemblies.length === 0 ? "No assemblies in the library" : "Name the line yourself…"}</option>
          {assemblies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.items.length} line{a.items.length === 1 ? "" : "s"} per {unitLabel(a.unit)}
            </option>
          ))}
        </select>
      </label>

      {assembly ? (
        <AssemblyItemsPreview assembly={assembly} gross={preview ? preview.gross * typical : null} />
      ) : (
        <label className={LABEL}>
          Description
          <input autoFocus className={FIELD} value={description} placeholder="225 mm blockwork wall" onChange={(e) => setDescription(e.target.value)} />
        </label>
      )}

      <label className={LABEL}>
        Element group
        <ComboInput items={groupItems} value={elementGroup} onChange={setElementGroup} placeholder="walls, floor finishes…" emptyText="Keep typing to name a new group." className="mt-1 h-9 px-3" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        {assembly ? null : (
          <label className={LABEL}>
            Unit
            <UnitInput value={unit} onChange={setUnit} className="mt-1 h-9 px-3" />
          </label>
        )}
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

      {assembly ? null : (
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
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>
          Discard
        </Button>
        <Button type="submit" size="sm" loading={submitting} disabled={!canSubmit}>
          {assembly ? `Add ${assembly.items.length} line${assembly.items.length === 1 ? "" : "s"}` : "Add to bill"}
        </Button>
      </div>
    </form>
  );
}
MeasurementComposer.displayName = "MeasurementComposer";
