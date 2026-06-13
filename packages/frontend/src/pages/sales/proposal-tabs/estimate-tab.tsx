import { useEffect, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import {
  useCreateEstimate,
  usePatchEstimate,
  useSendEstimate,
} from "@/hooks/use-proposals";
import { useAbility } from "@/contexts/ability-context";
import type { Estimate } from "@/api/proposals";
import { proposalsApi } from "@/api/proposals";
import { formatWholeCurrency as fmt } from "@/lib/formatters";
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
  estimate: Estimate | null;
  currency: string;
}

export function EstimateTab({ proposalId, estimate, currency }: Props) {
  const ability = useAbility();
  const canCreate = ability.can("create", "proposals");
  const canUpdate = ability.can("update", "proposals");
  const canSend = ability.can("send", "proposals");

  const createEstimate = useCreateEstimate(proposalId);
  const patchEstimate = usePatchEstimate(proposalId);
  const sendEstimate = useSendEstimate(proposalId);

  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const [items, setItems] = useState<ItemDraft[]>(() =>
    (estimate?.items ?? []).map((item) => ({
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

  const [contingencyPct, setContingencyPct] = useState(
    String(estimate?.contingencyPct ?? 0),
  );
  const [taxLabel, setTaxLabel] = useState(estimate?.taxLabel ?? "VAT");
  const [taxPct, setTaxPct] = useState(String(estimate?.taxPct ?? 0));

  // Estimate may load after first mount (e.g. user clicks "Create estimate" and
  // it materialises a moment later). useState only initialises once, so sync
  // form state when the estimate changes id.
  const estimateId = estimate?.id;
  useEffect(() => {
    if (!estimate) return;
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
    setContingencyPct(String(estimate.contingencyPct));
    setTaxLabel(estimate.taxLabel);
    setTaxPct(String(estimate.taxPct));
  }, [estimateId]);

  const isDraft = estimate?.status === "Draft";

  async function handleCreateRevision() {
    if (!changeNote.trim() && estimate) return;
    await createEstimate.mutateAsync({ changeNote: changeNote.trim() || undefined });
    setRevisionDrawerOpen(false);
    setChangeNote("");
  }

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
    if (!estimate) return;
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

  async function saveTotals() {
    if (!estimate) return;
    await patchEstimate.mutateAsync({
      estimateId: estimate.id,
      contingencyPct: parseFloat(contingencyPct) || 0,
      taxLabel: taxLabel.trim(),
      taxPct: parseFloat(taxPct) || 0,
    });
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState
          title="No estimate yet"
          description={
            canCreate
              ? "Create the first estimate for this proposal."
              : "No estimate has been created for this proposal yet."
          }
        />
        {canCreate && (
          <Button
            variant="primary"
            onClick={() => createEstimate.mutate({})}
            disabled={createEstimate.isPending}
          >
            {createEstimate.isPending ? "Creating…" : "Create estimate"}
          </Button>
        )}
        {createEstimate.isError && (
          <p className="text-xs text-red-600">Failed to create estimate.</p>
        )}
      </div>
    );
  }

  const rowClass = cn(
    "grid grid-cols-[2fr_3fr_1fr_1.5fr_1.5fr_auto] gap-2 items-start",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{estimate.revisionLabel}</span>
          <Badge tone={estimate.status === "Draft" ? "neutral" : estimate.status === "Accepted" ? "success" : "warning"}>
            {estimate.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {estimate.status === "Draft" && canSend && (
            <Button
              variant="primary"
              size="sm"
              disabled={sendEstimate.isPending}
              onClick={async () => {
                const result = await sendEstimate.mutateAsync(estimate.id);
                setShareUrl(result.shareUrl);
              }}
            >
              {sendEstimate.isPending ? "Sending…" : "Send to client"}
            </Button>
          )}
          {estimate.status !== "Draft" && canCreate && (
            <Button variant="secondary" size="sm" onClick={() => setRevisionDrawerOpen(true)}>
              New revision
            </Button>
          )}
        </div>
      </div>

      {(shareUrl ?? estimate.shareToken) && (
        <div className="flex items-center gap-3 rounded-xl border border-[#004DE7]/20 bg-blue-50 px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-[#004DE7]">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="flex-1 truncate text-xs text-[#004DE7]">
            {shareUrl ?? `${window.location.origin}/p/${estimate.shareToken}`}
          </span>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-[#004DE7] hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl ?? `${window.location.origin}/p/${estimate.shareToken ?? ""}`);
            }}
          >
            Copy link
          </button>
        </div>
      )}

      {sendEstimate.isError && (
        <p className="text-xs text-red-600">Failed to send estimate. Please try again.</p>
      )}

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
                <Input
                  className="h-9 text-xs"
                  type="number"
                  min="0"
                  value={item.unitRate}
                  onChange={(e) => updateItem(i, "unitRate", e.target.value)}
                  disabled={!isDraft}
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
                disabled={savingItems}
              >
                {savingItems ? "Saving…" : "Save items"}
              </Button>
              {saveItemsError && (
                <span className="text-xs text-red-600">{saveItemsError}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Totals
        </h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Contingency (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={contingencyPct}
                onChange={(e) => setContingencyPct(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Tax label</Label>
                <Input
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  placeholder="VAT"
                  disabled={!isDraft}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tax rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                  disabled={!isDraft}
                />
              </div>
            </div>
            {isDraft && canUpdate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={saveTotals}
                disabled={patchEstimate.isPending}
                className="self-start"
              >
                {patchEstimate.isPending ? "Updating…" : "Update totals"}
              </Button>
            )}
          </div>

          <div className="flex-1 rounded-xl bg-gray-50 p-4">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="font-medium">{fmt(estimate.subtotal, currency)}</dd>
              </div>
              {estimate.contingencyPct > 0 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <dt>Contingency ({estimate.contingencyPct}%)</dt>
                  <dd>{fmt(estimate.subtotal * estimate.contingencyPct / 100, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">{estimate.taxLabel} ({estimate.taxPct}%)</dt>
                <dd className="font-medium">{fmt(estimate.taxAmount, currency)}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-gray-200 pt-2">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-semibold text-gray-900">{fmt(estimate.total, currency)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <FormDrawer
        open={revisionDrawerOpen}
        onOpenChange={setRevisionDrawerOpen}
        title="New estimate revision"
        description="This will supersede the previous sent estimate. A change note is required."
        submitLabel="Create revision"
        submitDisabled={!changeNote.trim()}
        submitting={createEstimate.isPending}
        error={createEstimate.isError ? "Failed to create revision." : null}
        onSubmit={handleCreateRevision}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="change-note">Change note *</Label>
          <textarea
            id="change-note"
            rows={4}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Describe what changed in this revision…"
            className={cn(
              "w-full rounded-lg bg-[#F6F6F6] px-4 py-3 text-sm text-gray-900",
              "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
              "resize-none placeholder:text-gray-400",
            )}
          />
        </div>
      </FormDrawer>
    </div>
  );
}
