import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { preconApi, type PreconSnapshot, type PreconSummarySettings } from "@/api/precon";
import { useApplyPreconToProposal, useUpdatePreconSettings } from "@/hooks/use-precon";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

const SETTING_FIELDS: { key: keyof PreconSummarySettings; label: string }[] = [
  { key: "prelimsPct", label: "Preliminaries %" },
  { key: "contingencyPct", label: "Contingency %" },
  { key: "vatPct", label: "VAT %" },
];

interface OutputProps {
  snapshot: PreconSnapshot;
}

export function PreconOutputPanel({ snapshot }: OutputProps) {
  const navigate = useNavigate();
  const sessionId = snapshot.session.id;
  const updateSettings = useUpdatePreconSettings(sessionId);
  const applyToProposal = useApplyPreconToProposal(sessionId);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<keyof PreconSummarySettings, string>>>({});

  const { summary, settings, progress } = snapshot;
  const complete = progress.total > 0 ? Math.round((progress.verified / progress.total) * 100) : 0;

  const commit = (key: keyof PreconSummarySettings) => {
    const raw = drafts[key];
    if (raw === undefined) return;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0 && value <= 100 && value !== settings[key]) {
      updateSettings.mutate({ [key]: value });
    }
    setDrafts((d) => ({ ...d, [key]: undefined }));
  };

  const summaryLines: { label: string; value: number; strong?: boolean }[] = [
    { label: "Measured works", value: summary.measuredTotal },
    { label: `Preliminaries (${settings.prelimsPct}%)`, value: summary.prelims },
    { label: "Construction sum", value: summary.constructionSum },
    { label: `Contingency (${settings.contingencyPct}%)`, value: summary.contingency },
    { label: "Sub-total", value: summary.subTotal },
    { label: `VAT (${settings.vatPct}%)`, value: summary.vat },
    { label: "Grand total", value: summary.grandTotal, strong: true },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Bid summary</h2>
          <p className="text-xs text-gray-500">
            {progress.verified} of {progress.total} items verified ({complete}%). Figures below are recorded draft
            amounts — BuildPanda logs them; no money moves here.
          </p>
        </div>
        <dl className="space-y-1.5 text-sm">
          {summaryLines.map((line) => (
            <div key={line.label} className="flex justify-between">
              <dt className={line.strong ? "font-semibold text-gray-900" : "text-gray-500"}>{line.label}</dt>
              <dd className={line.strong ? "text-lg font-bold text-gray-900" : "tabular-nums text-gray-800"}>
                {naira.format(line.value)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
          {SETTING_FIELDS.map(({ key, label }) => (
            <label key={key} className="text-xs text-gray-500">
              {label}
              <input
                className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                inputMode="decimal"
                value={drafts[key] ?? settings[key]}
                onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                onBlur={() => commit(key)}
              />
            </label>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Bid pack</h2>
          <p className="text-xs text-gray-500">Export the BOQ workbook or apply the reviewed bill to the proposal.</p>
        </div>
        <div className="space-y-2">
          <a href={preconApi.exportUrl(sessionId)} download>
            <Button className="w-full">Download BOQ (Excel)</Button>
          </a>
          <Button
            variant="secondary"
            className="w-full"
            loading={applyToProposal.isPending}
            onClick={() =>
              applyToProposal.mutate(undefined, {
                onSuccess: (result) => {
                  setSendResult(`${result.itemCount} BOQ items applied to the proposal.`);
                  navigate(`/sales/proposals/${result.proposalId}`);
                },
                onError: (error) =>
                  setSendResult(error instanceof Error ? error.message : "Could not apply to the proposal"),
              })
            }
          >
            {snapshot.session.proposalId ? "Apply to proposal BoQ" : "Create proposal from this BOQ"}
          </Button>
          {sendResult ? <p className="text-xs text-gray-500">{sendResult}</p> : null}
        </div>
        <p className="border-t border-gray-100 pt-3 text-[11px] text-gray-400">
          Measured by Panda AI · verified line items carry the reviewer's name in the audit trail. A quantity surveyor
          must review before the bill is used contractually.
        </p>
      </Card>
    </div>
  );
}
PreconOutputPanel.displayName = "PreconOutputPanel";
