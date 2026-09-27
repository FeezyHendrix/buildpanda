import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { ComboInput } from "@/components/atoms/combo-input";
import { Input, INPUT_SM_CLASS } from "@/components/atoms/input";
import { UnitInput } from "@/components/atoms/unit-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import type { Assembly, AssemblyItem, UpsertAssemblyInput } from "@/api/precon";
import type { RateCard } from "@/api/rate-library";
import { useCreateAssembly, useUpdateAssembly } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { TAKEOFF_SECTIONS } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set; creating otherwise. */
  initial: Assembly | null;
  /** The cards whose rates an item can price against. */
  cards: RateCard[];
}

/** An item row while it is being edited: numbers stay text until submit. */
interface ItemDraft {
  key: number;
  description: string;
  unit: string;
  factor: string;
  elementGroup: string;
  rateId: string;
  code: string;
}

const LABEL = "block text-xs font-medium text-gray-600";
const FIELD = "mt-1 h-9 text-sm";
const STANDARD_GROUPS: string[] = TAKEOFF_SECTIONS.flatMap((section) => [...section.elements]);

let draftSeq = 0;

function toDraft(item?: AssemblyItem): ItemDraft {
  return {
    key: ++draftSeq,
    description: item?.description ?? "",
    unit: item?.unit ?? "",
    factor: item ? String(item.factor) : "1",
    elementGroup: item?.elementGroup ?? "",
    rateId: item?.rateId ?? "",
    code: item?.code ?? "",
  };
}

function fromDraft(draft: ItemDraft, fallbackGroup: string): AssemblyItem {
  return {
    description: draft.description.trim(),
    unit: draft.unit.trim(),
    factor: Number(draft.factor),
    elementGroup: draft.elementGroup.trim() || fallbackGroup,
    rateId: draft.rateId || null,
    code: draft.code.trim() || null,
  };
}

function draftValid(draft: ItemDraft): boolean {
  const factor = Number(draft.factor);
  return draft.description.trim() !== "" && draft.unit.trim() !== "" && Number.isFinite(factor) && factor > 0;
}

interface RateOption {
  id: string;
  label: string;
  unit: string;
}

function ItemRow({
  draft,
  rates,
  groups,
  onChange,
  onRemove,
}: {
  draft: ItemDraft;
  rates: RateOption[];
  groups: string[];
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-col gap-2">
        <Input inputSize="sm" placeholder="Item, e.g. Plaster both faces" value={draft.description} onChange={(e) => onChange({ description: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <label className={LABEL}>
            Unit
            <UnitInput value={draft.unit} onChange={(unit) => onChange({ unit })} className={FIELD} />
          </label>
          <label className={LABEL}>
            Factor
            <Input className={FIELD} inputMode="decimal" value={draft.factor} onChange={(e) => onChange({ factor: e.target.value })} />
          </label>
          <label className={LABEL}>
            Code
            <Input className={FIELD} placeholder="F10" value={draft.code} onChange={(e) => onChange({ code: e.target.value })} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={LABEL}>
            Element group
            <ComboInput items={groups} value={draft.elementGroup || null} onChange={(v) => onChange({ elementGroup: v ?? "" })} placeholder="inherits the assembly's" className={FIELD} />
          </label>
          <label className={LABEL}>
            Rate from the card
            <select
              className={cn(INPUT_SM_CLASS, "mt-1")}
              value={draft.rateId}
              onChange={(e) => {
                const picked = rates.find((r) => r.id === e.target.value);
                onChange({ rateId: e.target.value, ...(picked && !draft.unit ? { unit: picked.unit } : {}) });
              }}
            >
              <option value="">{rates.length === 0 ? "No rates in the library" : "Unpriced"}</option>
              {rates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <button type="button" aria-label="Remove item" className="self-start rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
ItemRow.displayName = "ItemRow";

/**
 * One drawer for create and edit. An assembly is a recipe: the base unit is
 * what the person draws, each item is a bill line at base × factor.
 */
export function UpsertAssemblyDialog({ open, onOpenChange, initial, cards }: Props) {
  const isEdit = initial !== null;
  const create = useCreateAssembly();
  const update = useUpdateAssembly();
  const mutation = isEdit ? update : create;

  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "m2");
  const [elementGroup, setElementGroup] = useState<string | null>(initial?.elementGroup ?? null);
  const [items, setItems] = useState<ItemDraft[]>(() => (initial?.items.length ? initial.items.map((i) => toDraft(i)) : [toDraft()]));

  const rates = useMemo<RateOption[]>(
    () =>
      cards.flatMap((card) =>
        card.rates.map((r) => ({
          id: r.id,
          unit: r.unit,
          label: `${r.label ?? r.descriptionPattern ?? r.codePrefix ?? card.name} · ${card.currency} ${r.rate.toLocaleString("en-NG")}/${r.unit}`,
        })),
      ),
    [cards],
  );
  const groups = useMemo(() => [...new Set([...(elementGroup ? [elementGroup] : []), ...STANDARD_GROUPS])], [elementGroup]);

  const patchItem = (key: number, patch: Partial<ItemDraft>) => setItems((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const canSubmit = name.trim() !== "" && unit.trim() !== "" && Boolean(elementGroup?.trim()) && items.length > 0 && items.every(draftValid);

  const submit = () => {
    if (!canSubmit || !elementGroup) return;
    const group = elementGroup.trim();
    const body: UpsertAssemblyInput = { name: name.trim(), unit: unit.trim(), elementGroup: group, items: items.map((d) => fromDraft(d, group)) };
    const done = {
      onSuccess: () => {
        toast(isEdit ? "Assembly saved." : "Assembly created.", "success");
        onOpenChange(false);
      },
      onError: (e: unknown) => toast(getApiErrorMessage(e, "Could not save the assembly."), "error"),
    };
    if (isEdit) update.mutate({ assemblyId: initial.id, body }, done);
    else create.mutate(body, done);
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit assembly" : "New assembly"}
      description="Draw one shape on a sheet and every item below joins the bill at the drawn quantity times its factor."
      submitLabel={isEdit ? "Save changes" : "Create assembly"}
      submitting={mutation.isPending}
      submitDisabled={!canSubmit}
      error={mutation.error ? getApiErrorMessage(mutation.error, "Could not save the assembly.") : null}
      onSubmit={submit}
      className="w-[min(560px,100vw)]"
    >
      <label className={LABEL}>
        Name
        <Input className={FIELD} placeholder="225 mm blockwork wall, plastered and painted" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>
          Drawn as
          <UnitInput value={unit} onChange={setUnit} className={FIELD} />
        </label>
        <label className={LABEL}>
          Element group
          <ComboInput items={groups} value={elementGroup} onChange={setElementGroup} placeholder="walls, floor finishes…" emptyText="Keep typing to name a new group." className={FIELD} />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">Items ({items.length})</p>
        <Button type="button" size="sm" variant="ghost" onClick={() => setItems((prev) => [...prev, toDraft()])}>
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          Add item
        </Button>
      </div>
      {items.map((draft) => (
        <ItemRow
          key={draft.key}
          draft={draft}
          rates={rates}
          groups={groups}
          onChange={(patch) => patchItem(draft.key, patch)}
          onRemove={() => setItems((prev) => prev.filter((d) => d.key !== draft.key))}
        />
      ))}
      {items.length === 0 ? <p className="text-xs text-red-600">An assembly needs at least one item.</p> : null}
    </FormDrawer>
  );
}
UpsertAssemblyDialog.displayName = "UpsertAssemblyDialog";
