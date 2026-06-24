import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { MoneyInput } from "@/components/atoms/money-input";
import { proposalsApi } from "@/api/proposals";
import type { Estimate } from "@/api/proposals";
import { cn } from "@/lib/utils";

interface ItemDraft {
  groupLabel: string;
  description: string;
  qty: string;
  unit: string;
  unitRate: string;
  sort: number;
}

function itemsToApi(items: ItemDraft[]) {
  return items.map((item, i) => ({
    groupLabel: item.groupLabel,
    description: item.description,
    qty: parseFloat(item.qty) || 0,
    unit: item.unit,
    unitRate: parseFloat(item.unitRate) || 0,
    boqItemId: null,
    sort: i,
  }));
}

interface Props {
  proposalId: string;
  estimate: Estimate;
  isDraft: boolean;
  canUpdate: boolean;
  symbol: string;
}

export function EstimateLineItems({ proposalId, estimate, isDraft, canUpdate, symbol }: Props) {
  const [items, setItems] = useState<ItemDraft[]>(() =>
    (estimate.items ?? []).map((item) => ({
      groupLabel: item.groupLabel,
      description: item.description,
      qty: String(item.qty),
      unit: item.unit,
      unitRate: String(item.unitRate),
      sort: item.sort,
    })),
  );
  const [savingItems, setSavingItems] = useState(false);
  const [saveItemsError, setSaveItemsError] = useState<string | null>(null);

  useEffect(() => {
    setItems(
      estimate.items.map((item) => ({
        groupLabel: item.groupLabel,
        description: item.description,
        qty: String(item.qty),
        unit: item.unit,
        unitRate: String(item.unitRate),
        sort: item.sort,
      })),
    );
  }, [estimate.id, estimate.items]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { groupLabel: "", description: "", qty: "1", unit: "item", unitRate: "0", sort: prev.length },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem<K extends keyof ItemDraft>(index: number, key: K, value: ItemDraft[K]) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  async function saveItems() {
    setSavingItems(true);
    setSaveItemsError(null);
    try {
      await proposalsApi.replaceItems(proposalId, estimate.id, itemsToApi(items));
    } catch {
      setSaveItemsError("Failed to save items.");
    } finally {
      setSavingItems(false);
    }
  }

  const rowClass = cn(
    "grid grid-cols-[2fr_3fr_1fr_1.5fr_1.5fr_auto] gap-2 items-start",
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Line items
        </h3>
      </div>
      <div className="p-4">
        {items.length > 0 && (
          <div className={cn(rowClass, "mb-2")}>
            {["Group", "Description", "Qty", "Unit", "Rate"].map((h) => (
              <span key={h} className="text-xs font-semibold text-gray-400">
                {h}
              </span>
            ))}
            <span />
          </div>
        )}
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i} className={rowClass}>
              <Input
                className="h-9 text-xs"
                value={item.groupLabel}
                onChange={(e) => updateItem(i, "groupLabel", e.target.value)}
                placeholder="Group"
                disabled={!isDraft}
              />
              <Input
                className="h-9 text-xs"
                value={item.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
                placeholder="Description"
                disabled={!isDraft}
              />
              <Input
                className="h-9 text-xs"
                type="number"
                min="0"
                value={item.qty}
                onChange={(e) => updateItem(i, "qty", e.target.value)}
                disabled={!isDraft}
              />
              <Input
                className="h-9 text-xs"
                value={item.unit}
                onChange={(e) => updateItem(i, "unit", e.target.value)}
                placeholder="m², item…"
                disabled={!isDraft}
              />
              <MoneyInput
                className="h-9 text-xs"
                value={item.unitRate}
                onChange={(v) => updateItem(i, "unitRate", v)}
                disabled={!isDraft}
                currencySymbol={symbol}
              />
              {isDraft ? (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove item"
                >
                  ×
                </button>
              ) : (
                <span className="w-8" />
              )}
            </div>
          ))}
        </div>

        {isDraft && canUpdate && (
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={addItem}>
              + Add line
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={saveItems}
              loading={savingItems}
            >
              Save items
            </Button>
            {saveItemsError && (
              <span className="text-xs text-red-600">{saveItemsError}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
