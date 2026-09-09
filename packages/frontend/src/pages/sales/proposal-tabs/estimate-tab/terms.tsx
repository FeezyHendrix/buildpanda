import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import {
  CLIENT_VISIBLE_DETAIL,
  RETENTION_MODES,
  WHT_RATES,
  type ClientVisibleDetail,
  type Estimate,
  type RetentionMode,
} from "@/api/proposals";
import { usePatchEstimateTerms } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  proposalId: string;
  estimate: Estimate;
  validUntil: string | null;
  isDraft: boolean;
  canEdit: boolean;
}

const RETENTION_LABEL: Record<RetentionMode, string> = { none: "None", cash: "Cash retention", bond: "Retention bond" };
const WHT_LABEL: Record<number, string> = { 0: "None (individual client)", 2: "2 % resident contractor", 5: "5 % non-resident" };
const DETAIL_LABEL: Record<ClientVisibleDetail, string> = { groups: "Group totals only", lines: "Every line with rates" };

function Segmented<T extends string | number>({
  value,
  options,
  labels,
  onChange,
  disabled,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (next: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((option) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "h-9 rounded-lg border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            value === option ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
Segmented.displayName = "Segmented";

// The money terms the client signs. Every field is on the revision, so a later
// revision can change them and the accepted snapshot keeps the old ones.
export function EstimateTermsPanel({ proposalId, estimate, validUntil, isDraft, canEdit }: Props) {
  const patch = usePatchEstimateTerms(proposalId);
  const [retentionPct, setRetentionPct] = useState(String(estimate.retentionPct ?? 5));
  const [retentionMode, setRetentionMode] = useState<RetentionMode>(estimate.retentionMode ?? "cash");
  const [advancePct, setAdvancePct] = useState(String(estimate.advancePct ?? 0));
  const [whtPct, setWhtPct] = useState<number>(estimate.whtPct ?? 0);
  const [paymentTermsDays, setPaymentTermsDays] = useState(String(estimate.paymentTermsDays ?? 14));
  const [defectsDays, setDefectsDays] = useState(String(estimate.defectsLiabilityDays ?? 365));
  const [detail, setDetail] = useState<ClientVisibleDetail>(estimate.clientVisibleDetail);
  const [validity, setValidity] = useState(validUntil ? validUntil.slice(0, 10) : "");

  useEffect(() => {
    setRetentionPct(String(estimate.retentionPct ?? 5));
    setRetentionMode(estimate.retentionMode ?? "cash");
    setAdvancePct(String(estimate.advancePct ?? 0));
    setWhtPct(estimate.whtPct ?? 0);
    setPaymentTermsDays(String(estimate.paymentTermsDays ?? 14));
    setDefectsDays(String(estimate.defectsLiabilityDays ?? 365));
    setDetail(estimate.clientVisibleDetail);
    setValidity(validUntil ? validUntil.slice(0, 10) : "");
  }, [estimate.id, estimate.retentionPct, estimate.retentionMode, estimate.advancePct, estimate.whtPct, estimate.paymentTermsDays, estimate.defectsLiabilityDays, estimate.clientVisibleDetail, validUntil]);

  const editable = isDraft && canEdit;

  const save = () =>
    patch.mutate(
      {
        estimateId: estimate.id,
        retentionPct: retentionMode === "none" ? 0 : parseFloat(retentionPct) || 0,
        retentionMode,
        advancePct: parseFloat(advancePct) || 0,
        whtPct,
        paymentTermsDays: parseInt(paymentTermsDays, 10) || 0,
        defectsLiabilityDays: parseInt(defectsDays, 10) || 0,
        clientVisibleDetail: detail,
        validUntil: validity ? new Date(validity).toISOString() : null,
      },
      {
        onSuccess: () => toast("Terms saved.", "success"),
        onError: (err) => toast(getApiErrorMessage(err, "Could not save the terms."), "error"),
      },
    );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Terms</h3>
          <p className="mt-1 text-sm text-gray-500">What the client signs alongside the price. Recorded on this revision.</p>
        </div>
        {editable ? (
          <Button size="sm" variant="secondary" loading={patch.isPending} onClick={save}>
            Save terms
          </Button>
        ) : null}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Retention</Label>
          <Segmented value={retentionMode} options={RETENTION_MODES} labels={RETENTION_LABEL} onChange={setRetentionMode} disabled={!editable} />
          {retentionMode !== "none" ? (
            <Input type="number" min="0" max="20" step="0.5" value={retentionPct} onChange={(e) => setRetentionPct(e.target.value)} disabled={!editable} placeholder="5" aria-label="Retention percent" />
          ) : null}
          <p className="text-xs text-gray-400">Half is released at practical completion, the rest after the defects period.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Advance on signing (%)</Label>
          <Input type="number" min="0" max="50" step="1" value={advancePct} onChange={(e) => setAdvancePct(e.target.value)} disabled={!editable} />
          <p className="text-xs text-gray-400">Recovered pro-rata from each stage. Mirrors the advance stage in the schedule.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Withholding tax</Label>
          <Segmented value={whtPct} options={WHT_RATES} labels={WHT_LABEL} onChange={setWhtPct} disabled={!editable} />
          <p className="text-xs text-gray-400">Deducted by corporate clients at source; they issue a credit note.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Payment terms (days)</Label>
            <Input type="number" min="0" max="365" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} disabled={!editable} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Defects liability (days)</Label>
            <Input type="number" min="0" max="3650" value={defectsDays} onChange={(e) => setDefectsDays(e.target.value)} disabled={!editable} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Client sees</Label>
          <Segmented value={detail} options={CLIENT_VISIBLE_DETAIL} labels={DETAIL_LABEL} onChange={setDetail} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Valid until</Label>
          <Input type="date" value={validity} onChange={(e) => setValidity(e.target.value)} disabled={!editable} />
        </div>
      </div>
    </div>
  );
}
EstimateTermsPanel.displayName = "EstimateTermsPanel";
