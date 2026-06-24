import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { usePatchEstimate } from "@/hooks/use-proposals";
import type { Estimate } from "@/api/proposals";
import { formatWholeCurrency as fmt } from "@/lib/formatters";

interface Props {
  proposalId: string;
  estimate: Estimate;
  isDraft: boolean;
  canUpdate: boolean;
  currency: string;
}

export function EstimateTotals({ proposalId, estimate, isDraft, canUpdate, currency }: Props) {
  const [contingencyPct, setContingencyPct] = useState(
    String(estimate.contingencyPct ?? 0),
  );
  const [taxLabel, setTaxLabel] = useState(estimate.taxLabel ?? "VAT");
  const [taxPct, setTaxPct] = useState(String(estimate.taxPct ?? 0));

  const patchEstimate = usePatchEstimate(proposalId);

  useEffect(() => {
    setContingencyPct(String(estimate.contingencyPct));
    setTaxLabel(estimate.taxLabel);
    setTaxPct(String(estimate.taxPct));
  }, [estimate.id, estimate.contingencyPct, estimate.taxLabel, estimate.taxPct]);

  async function saveTotals() {
    await patchEstimate.mutateAsync({
      estimateId: estimate.id,
      contingencyPct: parseFloat(contingencyPct) || 0,
      taxLabel: taxLabel.trim(),
      taxPct: parseFloat(taxPct) || 0,
    });
  }

  return (
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
              loading={patchEstimate.isPending}
              className="self-start"
            >
              Update totals
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
  );
}
