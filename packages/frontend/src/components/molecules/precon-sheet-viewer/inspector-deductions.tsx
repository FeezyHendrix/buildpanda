import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { PreconBoqRow } from "@/api/precon";
import type { DeductionMode } from "@/api/precon-editor";
import { InspectorStatedDeduction } from "./inspector-stated-deduction";
import type { useRowCommands } from "./use-row-commands";

const FIELD = "mt-1 h-8 w-full rounded-md border border-line px-2 text-sm tabular-nums";
const LABEL = "block text-xs font-medium text-gray-600";

/**
 * Which stated dimensions each mode takes, named for what they measure — a
 * wall opening is an ELEVATION width × height, never a plan footprint
 * (contract 6), and a volume cutout carries its own depth.
 */
const MODE_FIELDS: Record<string, { mode: DeductionMode; title: string; fields: { key: "widthM" | "heightM" | "depthM"; label: string }[] }> = {
  wall_area: {
    mode: "wall-opening",
    title: "Opening in the wall (elevation)",
    fields: [
      { key: "widthM", label: "Opening width (m)" },
      { key: "heightM", label: "Opening height (m)" },
    ],
  },
  volume: {
    mode: "volume",
    title: "Cutout through the slab (plan × depth)",
    fields: [
      { key: "widthM", label: "Plan width (m)" },
      { key: "heightM", label: "Plan length (m)" },
      { key: "depthM", label: "Cutout depth (m)" },
    ],
  },
  area: {
    mode: "area",
    title: "Plan cutout",
    fields: [
      { key: "widthM", label: "Plan width (m)" },
      { key: "heightM", label: "Plan length (m)" },
    ],
  },
};

interface Props {
  row: PreconBoqRow;
  /** The parent's tool, which decides what a stated cutout's dimensions mean. */
  parentTool: string;
  commands: ReturnType<typeof useRowCommands>;
}

export function InspectorDeductions({ row, parentTool, commands }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statedIndex, setStatedIndex] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const spec = MODE_FIELDS[parentTool] ?? MODE_FIELDS.area!;
  const parsed = spec.fields.map((f) => Number(values[f.key] ?? ""));
  const allPositive = parsed.every((v) => Number.isFinite(v) && v > 0);

  const close = () => {
    setAdding(false);
    setEditingId(null);
    setLabel("");
    setValues({});
  };
  const submit = () => {
    const dimensions = Object.fromEntries(spec.fields.map((f, i) => [f.key, parsed[i]!]));
    if (editingId) commands.editDeduction(row, editingId, dimensions, close);
    else commands.addDeduction(row, { label: label.trim(), mode: spec.mode, dimensions }, close);
  };

  return (
    <div data-deductions>
      <p className="text-xs font-semibold text-gray-900">Deductions</p>
      {row.deductions.length === 0 ? <p className="mt-1 text-xs text-gray-500">None taken off this line.</p> : null}
      <ul className="mt-1 space-y-1">
        {row.deductions.map((deduction, index) => (
          <li key={`${deduction.geometryId ?? deduction.label}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-surface-alt px-2 py-1 text-xs">
            <span className="min-w-0 truncate text-gray-800">{deduction.label}</span>
            <span className="shrink-0 tabular-nums text-gray-600">−{deduction.qty}</span>
            {deduction.geometryId ? (
              <button
                type="button"
                aria-label={`Edit ${deduction.label}`}
                title="Restate this cutout's dimensions"
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                onClick={() => {
                  setEditingId(deduction.geometryId);
                  setAdding(true);
                  setLabel(deduction.label);
                  const dims = deduction.dimensions ?? {};
                  setValues(Object.fromEntries(Object.entries(dims).flatMap(([k, v]) => (typeof v === "number" ? [[k, String(v)]] : []))));
                }}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
            {deduction.geometryId ? (
              <button
                type="button"
                aria-label={`Remove ${deduction.label}`}
                title="Remove this cutout (reversible)"
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => commands.removeDeduction(row, deduction.geometryId!)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                data-stated-edit={index}
                title="A stated legacy figure with no drawn shape and an unconfirmed unit — re-enter or remove it"
                className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200"
                onClick={() => setStatedIndex(statedIndex === index ? null : index)}
              >
                stated · fix
              </button>
            )}
          </li>
        ))}
      </ul>
      {statedIndex !== null && row.deductions[statedIndex] && !row.deductions[statedIndex]!.geometryId ? (
        <InspectorStatedDeduction
          row={row}
          deduction={row.deductions[statedIndex]!}
          index={statedIndex}
          commands={commands}
          onClose={() => setStatedIndex(null)}
        />
      ) : null}
      {adding ? (
        <div className="mt-2 rounded-md border border-line p-2">
          <p className="text-xs font-medium text-gray-700">{editingId ? `Restate “${label}”` : spec.title}</p>
          {editingId ? null : (
            <label className={`${LABEL} mt-1`}>
              Name
              <input aria-label="Cutout name" className={FIELD} value={label} placeholder="Window W1" onChange={(e) => setLabel(e.target.value)} />
            </label>
          )}
          <div className="mt-1 grid grid-cols-2 gap-2">
            {spec.fields.map((f) => (
              <label key={f.key} className={LABEL}>
                {f.label}
                <input aria-label={f.label} className={FIELD} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" loading={commands.saving} disabled={(!editingId && label.trim() === "") || !allPositive} onClick={submit}>
              {editingId ? "Save cutout" : "Add cutout"}
            </Button>
            <Button size="sm" variant="secondary" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => setAdding(true)}>
          Add named cutout
        </Button>
      )}
    </div>
  );
}
InspectorDeductions.displayName = "InspectorDeductions";
