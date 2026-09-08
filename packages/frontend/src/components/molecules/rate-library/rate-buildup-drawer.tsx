import { useEffect, useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { BUILDUP_COMPONENTS, type BuildupComponent, type BuildupInput, type Rate } from "@/api/rate-library";
import { useSetRateBuildups } from "@/hooks/use-rate-library";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatWholeCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const COMPONENT_LABEL: Record<BuildupComponent, string> = {
  labour: "Labour",
  material: "Material",
  plant: "Plant",
  subcontract: "Subcontract",
  overhead: "Overhead & profit",
};

interface LineDraft {
  component: BuildupComponent;
  description: string;
  qty: string;
  unit: string;
  unitCost: string;
  wastePct: string;
}

const EMPTY_LINE: LineDraft = { component: "material", description: "", qty: "1", unit: "item", unitCost: "0", wastePct: "0" };

const selectClass = cn(
  "h-9 w-full rounded-lg bg-[#F6F6F6] px-2 text-xs text-gray-900",
  "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
);

function lineCost(line: LineDraft): number {
  const qty = parseFloat(line.qty) || 0;
  const cost = parseFloat(line.unitCost) || 0;
  const waste = parseFloat(line.wastePct) || 0;
  return Math.round(qty * cost * (1 + waste / 100) * 100) / 100;
}

function toInput(line: LineDraft): BuildupInput {
  return {
    component: line.component,
    description: line.description.trim(),
    qty: parseFloat(line.qty) || 0,
    unit: line.unit.trim() || "item",
    unitCost: parseFloat(line.unitCost) || 0,
    wastePct: parseFloat(line.wastePct) || 0,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  currency: string;
  rate: Rate | null;
}

export function RateBuildupDrawer({ open, onOpenChange, cardId, currency, rate }: Props) {
  const save = useSetRateBuildups();
  const [lines, setLines] = useState<LineDraft[]>([]);

  useEffect(() => {
    if (!open || !rate) return;
    setLines(
      rate.buildups.length
        ? rate.buildups.map((b) => ({
            component: b.component,
            description: b.description,
            qty: String(b.qty),
            unit: b.unit,
            unitCost: String(b.unitCost),
            wastePct: String(b.wastePct),
          }))
        : [EMPTY_LINE],
    );
  }, [open, rate]);

  const update = (index: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const total = Math.round(lines.reduce((sum, l) => sum + lineCost(l), 0) * 100) / 100;
  const valid = lines.every((l) => l.description.trim().length > 0);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={rate ? `Build up: ${rate.label ?? rate.descriptionPattern ?? rate.unit}` : "Build up rate"}
      description="Labour, materials with waste, plant and overheads. The rate becomes the sum of these lines."
      submitLabel="Save build-up"
      submitDisabled={!valid || !rate}
      submitting={save.isPending}
      error={save.error ? getApiErrorMessage(save.error, "Could not save the build-up.") : null}
      onSubmit={() => {
        if (!rate) return;
        save.mutate({ cardId, rateId: rate.id, lines: lines.map(toInput) }, { onSuccess: () => onOpenChange(false) });
      }}
      className="w-[min(720px,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-[1.1fr_2fr_0.7fr_0.7fr_1fr_0.7fr_auto] items-center gap-1.5">
            <select className={selectClass} value={line.component} onChange={(e) => update(i, { component: e.target.value as BuildupComponent })}>
              {BUILDUP_COMPONENTS.map((c) => (
                <option key={c} value={c}>{COMPONENT_LABEL[c]}</option>
              ))}
            </select>
            <Input className="h-9 text-xs" placeholder="Description" value={line.description} onChange={(e) => update(i, { description: e.target.value })} />
            <Input className="h-9 text-xs" type="number" min="0" step="any" inputMode="decimal" value={line.qty} onChange={(e) => update(i, { qty: e.target.value })} aria-label="Quantity" />
            <Input className="h-9 text-xs" placeholder="unit" value={line.unit} onChange={(e) => update(i, { unit: e.target.value })} aria-label="Unit" />
            <Input className="h-9 text-xs" type="number" min="0" step="any" inputMode="decimal" value={line.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} aria-label="Unit cost" />
            <Input className="h-9 text-xs" type="number" min="0" max="100" step="any" inputMode="decimal" value={line.wastePct} onChange={(e) => update(i, { wastePct: e.target.value })} aria-label="Waste percent" />
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
              className="flex h-9 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              ×
            </button>
          </div>
        ))}
        <div className="grid grid-cols-[1.1fr_2fr_0.7fr_0.7fr_1fr_0.7fr_auto] gap-1.5 text-[11px] text-gray-400">
          <span>Component</span><span>Description</span><span>Qty</span><span>Unit</span><span>Unit cost</span><span>Waste %</span><span />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <Button variant="secondary" size="sm" onClick={() => setLines((prev) => [...prev, EMPTY_LINE])}>
          + Add line
        </Button>
        <p className="text-sm text-gray-700">
          Rate becomes <span className="font-semibold text-gray-900">{formatWholeCurrency(total, currency)}</span>
          {rate ? <span className="text-gray-400"> per {rate.unit}</span> : null}
        </p>
      </div>
    </FormDrawer>
  );
}
RateBuildupDrawer.displayName = "RateBuildupDrawer";
