import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { useProposalBoq, useReplaceBoq } from "@/hooks/use-proposals";
import { proposalsApi } from "@/api/proposals";
import { UnitInput } from "@/components/atoms/unit-input";

interface BoqDraft {
  groupLabel: string;
  description: string;
  qty: string;
  unit: string;
}

interface Props {
  proposalId: string;
  estimateId: string | null;
}

export function BoqTab({ proposalId, estimateId }: Props) {
  const { data, isLoading } = useProposalBoq(proposalId);
  const replace = useReplaceBoq(proposalId);
  const [items, setItems] = useState<BoqDraft[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setItems(
      data.map((item) => ({
        groupLabel: item.groupLabel,
        description: item.description,
        qty: String(item.qty),
        unit: item.unit,
      })),
    );
  }, [data]);

  function update(idx: number, key: keyof BoqDraft, value: string) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  function addRow() {
    setItems((prev) => [...prev, { groupLabel: "", description: "", qty: "1", unit: "m²" }]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    await replace.mutateAsync(
      items
        .filter((row) => row.description.trim().length > 0)
        .map((row, idx) => ({
          groupLabel: row.groupLabel.trim() || "General",
          description: row.description.trim(),
          qty: parseFloat(row.qty) || 0,
          unit: row.unit.trim() || "item",
          sort: idx,
        })),
    );
    setSavedAt(Date.now());
  }

  async function priceIntoEstimate() {
    if (!estimateId) return;
    await proposalsApi.replaceItems(
      proposalId,
      estimateId,
      items
        .filter((row) => row.description.trim().length > 0)
        .map((row, idx) => ({
          groupLabel: row.groupLabel.trim() || "General",
          description: row.description.trim(),
          qty: parseFloat(row.qty) || 0,
          unit: row.unit.trim() || "item",
          unitRate: 0,
          boqItemId: null,
          sort: idx,
        })),
    );
  }

  async function exportBoq() {
    setExporting(true);
    try {
      const blob = await proposalsApi.exportBoq(proposalId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposal-${proposalId}-boq.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
        Use this tab for the architect's bill of quantities: what needs to be built and
        how much of it, without prices. When you're ready, click <strong>Price into estimate</strong>{" "}
        to seed the Estimate tab with these line items and set the rates.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Editable BoQ workspace</p>
          <p className="mt-1 text-sm text-gray-500">
            Review auto-generated take-off lines, adjust quantities, then export a professionally structured workbook.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void exportBoq()} disabled={items.length === 0} loading={exporting}>
          Export XLSX
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No BoQ items yet"
          description="Add your first line item. Items typically come from architectural take-offs."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Group</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Unit</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <Input value={row.groupLabel} onChange={(e) => update(idx, "groupLabel", e.target.value)} placeholder="Group" />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={row.description} onChange={(e) => update(idx, "description", e.target.value)} placeholder="Description" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} step="any" inputMode="decimal" value={row.qty} onChange={(e) => update(idx, "qty", e.target.value)} className="text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <UnitInput
                      value={row.unit}
                      onChange={(v) => update(idx, "unit", v)}
                      className="flex h-11 w-full rounded-lg bg-[#F6F6F6] px-4 text-sm text-gray-900 border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          + Add row
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={save}
          loading={replace.isPending}
        >
          Save BOQ
        </Button>
        {estimateId && items.length > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={priceIntoEstimate}>
            Price into estimate →
          </Button>
        )}
        {savedAt && Date.now() - savedAt < 4000 && (
          <span className="text-xs text-green-600">Saved.</span>
        )}
      </div>
    </div>
  );
}
