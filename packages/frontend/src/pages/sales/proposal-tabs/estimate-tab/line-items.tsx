import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { MoneyInput } from "@/components/atoms/money-input";
import { proposalsApi } from "@/api/proposals";
import type { Estimate } from "@/api/proposals";
import { cn } from "@/lib/utils";
import { UnitInput } from "@/components/atoms/unit-input";
import { TakeoffLinkChip, useTakeoffLineStatuses } from "./takeoff-link-chip";
import { useMatchRates } from "@/hooks/use-rate-library";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface ItemDraft {
  groupLabel: string;
  description: string;
  qty: string;
  unit: string;
  unitRate: string;
  boqItemId: string | null;
  takeoffSessionId: string | null;
  sort: number;
}

// Links to take-off lines survive a save: quantity flows through the link,
// the rate is the estimator's. Editing the description or quantity by hand
// keeps the link so the chip still shows where the number came from.
function itemsToApi(items: ItemDraft[]) {
  return items.map((item, i) => ({
    groupLabel: item.groupLabel,
    description: item.description,
    qty: parseFloat(item.qty) || 0,
    unit: item.unit,
    unitRate: parseFloat(item.unitRate) || 0,
    boqItemId: item.boqItemId,
    takeoffSessionId: item.takeoffSessionId,
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
      boqItemId: item.boqItemId,
      takeoffSessionId: item.takeoffSessionId,
      sort: item.sort,
    })),
  );
  const statuses = useTakeoffLineStatuses(
    (estimate.items ?? []).flatMap((item) => (item.takeoffSessionId ? [item.takeoffSessionId] : [])),
  );
  const [savingItems, setSavingItems] = useState(false);
  const [saveItemsError, setSaveItemsError] = useState<string | null>(null);
  const matchRates = useMatchRates();

  // Fills only the lines whose rate is still zero, so hand-entered figures survive.
  function fillRatesFromLibrary() {
    matchRates.mutate(
      items.map((item) => ({ description: item.description, unit: item.unit })),
      {
        onSuccess: (matches) => {
          const byIndex = new Map(matches.map((m) => [m.index, m]));
          let filled = 0;
          setItems((prev) =>
            prev.map((item, i) => {
              const hit = byIndex.get(i);
              if (!hit || (parseFloat(item.unitRate) || 0) > 0) return item;
              filled++;
              return { ...item, unitRate: String(hit.rate) };
            }),
          );
          toast(
            filled > 0
              ? `${filled} line${filled === 1 ? "" : "s"} priced from ${matches[0]?.cardName ?? "the rate library"}. Save items to keep them.`
              : "No library rates matched the unpriced lines. Check units and descriptions against the rate card.",
            filled > 0 ? "success" : "info",
          );
        },
        onError: (e) => toast(getApiErrorMessage(e, "Could not look up rates."), "error"),
      },
    );
  }

  useEffect(() => {
    setItems(
      estimate.items.map((item) => ({
        groupLabel: item.groupLabel,
        description: item.description,
        qty: String(item.qty),
        unit: item.unit,
        unitRate: String(item.unitRate),
        boqItemId: item.boqItemId,
        takeoffSessionId: item.takeoffSessionId,
        sort: item.sort,
      })),
    );
  }, [estimate.id, estimate.items]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { groupLabel: "", description: "", qty: "1", unit: "item", unitRate: "0", boqItemId: null, takeoffSessionId: null, sort: prev.length },
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
    "grid grid-cols-[2fr_3fr_1fr_1.5fr_1.5fr_auto_auto] gap-2 items-start",
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
            {["Group", "Description", "Qty", "Unit", "Rate", "Source"].map((h) => (
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
                step="any"
                inputMode="decimal"
                value={item.qty}
                onChange={(e) => updateItem(i, "qty", e.target.value)}
                disabled={!isDraft}
              />
              <UnitInput
                value={item.unit}
                onChange={(v) => updateItem(i, "unit", v)}
                disabled={!isDraft}
                className="h-9 w-full rounded-lg bg-[#F6F6F6] px-2.5 text-xs text-gray-900 border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <MoneyInput
                className="h-9 text-xs"
                value={item.unitRate}
                onChange={(v) => updateItem(i, "unitRate", v)}
                disabled={!isDraft}
                currencySymbol={symbol}
              />
              <span className="flex h-9 items-center">
                <TakeoffLinkChip boqItemId={item.boqItemId} takeoffSessionId={item.takeoffSessionId} statuses={statuses} />
              </span>
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
            <Button variant="secondary" size="sm" onClick={fillRatesFromLibrary} loading={matchRates.isPending} disabled={items.length === 0}>
              Fill rates from library
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
