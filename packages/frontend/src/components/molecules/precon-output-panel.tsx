import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PreconApplyDialog } from "@/components/molecules/precon-apply-dialog";
import { preconApi, preconManualApi, type PreconSnapshot, type PreconSummarySettings } from "@/api/precon";
import { useApplyPreconToProposal, useUpdatePreconSettings } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const squareMetres = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const slugify = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "takeoff";

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const SETTING_FIELDS: { key: keyof PreconSummarySettings; label: string }[] = [
  { key: "prelimsPct", label: "Preliminaries %" },
  { key: "contingencyPct", label: "Contingency %" },
  { key: "vatPct", label: "VAT %" },
];

interface OutputProps {
  snapshot: PreconSnapshot;
}

function BidSummaryCard({ snapshot }: { snapshot: PreconSnapshot }) {
  const { summary, settings, progress } = snapshot;
  const updateSettings = useUpdatePreconSettings(snapshot.session.id);
  const [drafts, setDrafts] = useState<Partial<Record<keyof PreconSummarySettings, string>>>({});
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

  const lines: { label: string; value: number; strong?: boolean }[] = [
    { label: "Measured works", value: summary.measuredTotal },
    { label: `Preliminaries (${settings.prelimsPct}%)`, value: summary.prelims },
    { label: "Construction sum", value: summary.constructionSum },
    { label: `Contingency (${settings.contingencyPct}%)`, value: summary.contingency },
    { label: "Sub-total", value: summary.subTotal },
    { label: `VAT (${settings.vatPct}%)`, value: summary.vat },
    { label: "Grand total", value: summary.grandTotal, strong: true },
  ];

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Bid summary</h2>
        <p className="text-xs text-gray-500">
          {progress.verified} of {progress.total} items verified ({complete}%). Figures below are recorded draft amounts —
          BuildPanda logs them; no money moves here.
        </p>
      </div>
      <dl className="space-y-1.5 text-sm">
        {lines.map((line) => (
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
              className="mt-0.5 h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100"
              inputMode="decimal"
              value={drafts[key] ?? settings[key]}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              onBlur={() => commit(key)}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}
BidSummaryCard.displayName = "BidSummaryCard";

function AreasSummaryCard({ snapshot }: { snapshot: PreconSnapshot }) {
  const { progress } = snapshot;
  const spaces = snapshot.rows.filter((r) => r.rowType === "item" && r.status !== "rejected");
  const totalM2 = spaces.reduce((sum, r) => sum + (r.unit === "m2" ? (r.qty ?? 0) : 0), 0);
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Measured areas</h2>
        <p className="text-xs text-gray-500">
          {progress.verified} of {progress.total} spaces verified. Nothing is priced — this sheet lists floor areas only.
        </p>
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Spaces identified</dt>
          <dd className="tabular-nums text-gray-800">{spaces.length}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-gray-900">Total floor area</dt>
          <dd className="text-lg font-bold text-gray-900">{squareMetres.format(totalM2)} m²</dd>
        </div>
      </dl>
    </Card>
  );
}
AreasSummaryCard.displayName = "AreasSummaryCard";

export function PreconOutputPanel({ snapshot }: OutputProps) {
  const navigate = useNavigate();
  const { session, progress } = snapshot;
  const applyToProposal = useApplyPreconToProposal(session.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const areas = session.scope.kind === "areas";
  const manual = session.takeoffKind === "manual";
  const linked = Boolean(session.proposalId);
  const applyLabel = linked ? "Bring into the estimate" : "Create proposal from this take-off";

  // The CSV comes through the axios client (credentials, 401 handling), then
  // is handed to the browser as a file — the same path the programme XML takes.
  async function downloadCsv() {
    setExportingCsv(true);
    try {
      saveBlob(await preconManualApi.exportCsv(session.id), `${slugify(session.title)}-takeoff.csv`);
    } catch (error) {
      toast(getApiErrorMessage(error, "Could not export the CSV."), "error");
    } finally {
      setExportingCsv(false);
    }
  }

  const apply = () =>
    applyToProposal.mutate(undefined, {
      onSuccess: (result) => {
        setConfirmOpen(false);
        toast(`Proposal created with ${result.itemCount} line${result.itemCount === 1 ? "" : "s"} as its first take-off.`, "success");
        navigate(`/sales/proposals/${result.proposalId}?tab=takeoffs`);
      },
      onError: (error) => {
        setConfirmOpen(false);
        toast(getApiErrorMessage(error, "Could not apply to the proposal."), "error");
      },
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {areas ? <AreasSummaryCard snapshot={snapshot} /> : <BidSummaryCard snapshot={snapshot} />}

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{areas ? "Areas schedule" : "Bid pack"}</h2>
          <p className="text-xs text-gray-500">
            {areas
              ? "Export the areas workbook or bring the spaces into the estimate as lines."
              : "Export the BOQ workbook or bring the reviewed bill into the estimate. You will see every change first."}
          </p>
        </div>
        <div className="space-y-2">
          <Button className="w-full" onClick={() => window.open(preconApi.exportUrl(session.id), "_blank")}>
            {areas ? "Download areas (Excel)" : "Export Excel"}
          </Button>
          {areas ? null : (
            <p className="text-[11px] text-gray-500">
              Live formulas, not pasted figures: net = gross − deductions × typical, amount = net × rate, subtotals and the grand total as SUM.
              Change a rate in the workbook and the bill re-adds itself. A Measurements sheet lists every line's sheet, tool, gross and basis.
            </p>
          )}
          <Button variant="secondary" className="w-full" loading={exportingCsv} onClick={() => void downloadCsv()}>
            <Download className="mr-1.5 size-3.5" aria-hidden="true" />
            Export CSV
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => (linked ? setApplyOpen(true) : setConfirmOpen(true))}>
            {applyLabel}
          </Button>
          {progress.total > 0 && progress.verified < progress.total ? (
            <p className="text-xs text-amber-700">
              {progress.total - progress.verified} line{progress.total - progress.verified === 1 ? "" : "s"} still
              unverified. Unreviewed AI lines are applied as drafted.
            </p>
          ) : null}
        </div>
        <p className="border-t border-gray-100 pt-3 text-[11px] text-gray-400">
          {manual
            ? "Measured by hand · every line carries the name of the person who drew it in the audit trail. A quantity surveyor must review before the bill is used contractually."
            : "Measured by Panda AI · verified line items carry the reviewer's name in the audit trail. A quantity surveyor must review before the bill is used contractually."}
        </p>
      </Card>

      {session.proposalId ? (
        <PreconApplyDialog open={applyOpen} onOpenChange={setApplyOpen} sessionId={session.id} proposalId={session.proposalId} />
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Create a proposal from this take-off?"
        description="A new proposal is created and this take-off is linked to it. Bring the lines into its estimate from there."
        confirmLabel="Create proposal"
        loading={applyToProposal.isPending}
        onConfirm={apply}
      />
    </div>
  );
}
PreconOutputPanel.displayName = "PreconOutputPanel";
