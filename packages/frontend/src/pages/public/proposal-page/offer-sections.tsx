import type { BuyingListLine, Estimate, PackSection, PublicCompany } from "@/api/proposals";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { formatWholeCurrency as fmt } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";

const SECTION_TITLE: Partial<Record<PackSection["kind"], string>> = {
  scope: "Scope of works",
  exclusions: "Exclusions",
  assumptions: "Assumptions",
  provisional_sums: "Provisional sums",
  warranties: "Warranties",
  terms: "Terms and conditions",
};

export function SectionHeading({ children }: { children: string }) {
  return <h2 className="mb-3 text-xs font-medium uppercase text-ink-muted">{children}</h2>;
}
SectionHeading.displayName = "SectionHeading";

export function CompanyBlock({ company }: { company: PublicCompany }) {
  const lines = [company.address, company.phone, company.email, company.website].filter(Boolean) as string[];
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {company.logo ? <img src={company.logo} alt="" className="size-10 rounded-lg object-cover" /> : null}
        <div>
          <p className="text-sm font-semibold text-gray-900">{company.name}</p>
          {lines.length > 0 ? <p className="text-xs text-gray-500">{lines.join(" · ")}</p> : null}
        </div>
      </div>
      {company.insuranceReference ? (
        <p className="text-right text-xs text-gray-500">
          Insured · <span className="font-mono">{company.insuranceReference}</span>
        </p>
      ) : null}
    </div>
  );
}
CompanyBlock.displayName = "CompanyBlock";

export function ScopeSection({ sections, brief }: { sections: PackSection[]; brief: string | null }) {
  const scope = sections.find((s) => s.kind === "scope");
  if (!scope && !brief) return null;
  return (
    <div>
      <SectionHeading>Scope of works</SectionHeading>
      {scope ? (
        <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: scope.bodyHtml }} />
      ) : (
        <p className="whitespace-pre-line text-sm text-gray-700">{brief}</p>
      )}
    </div>
  );
}
ScopeSection.displayName = "ScopeSection";

export function ProseSections({ sections, kinds }: { sections: PackSection[]; kinds: PackSection["kind"][] }) {
  const present = kinds.map((k) => sections.find((s) => s.kind === k)).filter((s): s is PackSection => Boolean(s && s.bodyHtml.trim()));
  if (present.length === 0) return null;
  return (
    <>
      {present.map((section) => (
        <div key={section.id}>
          <SectionHeading>{SECTION_TITLE[section.kind] ?? section.kind}</SectionHeading>
          <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
        </div>
      ))}
    </>
  );
}
ProseSections.displayName = "ProseSections";

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line-hair py-2 text-sm last:border-0">
      <span className={strong ? "font-semibold text-gray-900" : "text-gray-500"}>{label}</span>
      <span className={strong ? "font-semibold text-gray-900" : "text-right font-medium text-gray-900"}>{value}</span>
    </div>
  );
}
Row.displayName = "Row";

export function PriceSection({ estimate, currency }: { estimate: Estimate; currency: string }) {
  const grouped = estimate.clientVisibleDetail === "groups";
  return (
    <div>
      <SectionHeading>Price</SectionHeading>
      {estimate.items.length > 0 ? (
        <div className="mb-4 overflow-hidden rounded-lg border border-line">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>{grouped ? "Section" : "Description"}</TableHeaderCell>
                {grouped ? null : <TableHeaderCell align="right">Qty</TableHeaderCell>}
                {grouped ? null : <TableHeaderCell align="right">Rate</TableHeaderCell>}
                <TableHeaderCell align="right">Total</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {estimate.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium text-gray-800">{item.description}</p>
                    {!grouped && item.groupLabel ? <p className="text-xs text-gray-400">{item.groupLabel}</p> : null}
                  </TableCell>
                  {grouped ? null : <TableCell align="right" className="text-gray-600">{item.qty} {item.unit}</TableCell>}
                  {grouped ? null : <TableCell align="right" className="text-gray-600">{fmt(item.unitRate, currency)}</TableCell>}
                  <TableCell align="right" className="font-medium text-gray-800">{fmt(item.total, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <div className="rounded-lg bg-gray-50 p-4">
        <Row label="Subtotal" value={fmt(estimate.subtotal, currency)} />
        {estimate.contingencyPct > 0 ? (
          <Row label={`Contingency (${estimate.contingencyPct}%)`} value={fmt((estimate.subtotal * estimate.contingencyPct) / 100, currency)} />
        ) : null}
        <Row label={`${estimate.taxLabel} (${estimate.taxPct}%)`} value={fmt(estimate.taxAmount, currency)} />
        <div className="mt-1 flex justify-between gap-4 border-t border-line pt-3">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="text-xl font-medium text-primary-600">{fmt(estimate.total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
PriceSection.displayName = "PriceSection";

export function StagesSection({ estimate, currency }: { estimate: Estimate; currency: string }) {
  if (estimate.schedule.length === 0) return null;
  const terms: string[] = [];
  if (estimate.retentionPct) terms.push(`${estimate.retentionPct}% retention, half released at handover and the rest after ${estimate.defectsLiabilityDays ?? 365} days`);
  if (estimate.whtPct) terms.push(`withholding tax at ${estimate.whtPct}% is deducted by you and a credit note issued`);
  if (estimate.paymentTermsDays) terms.push(`each stage is payable within ${estimate.paymentTermsDays} days`);
  return (
    <div>
      <SectionHeading>Pay as you go</SectionHeading>
      <div className="flex flex-col gap-2">
        {estimate.schedule.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-line-hair bg-gray-50 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-gray-800">
                {s.label}
                {s.kind === "advance" ? <Badge tone="info" className="ml-2">On signing</Badge> : null}
              </p>
              {s.description ? <p className="text-xs text-gray-400">{s.description}</p> : null}
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">{fmt((estimate.total * s.percent) / 100, currency)}</p>
              <p className="text-xs text-gray-400">{s.percent}%</p>
            </div>
          </div>
        ))}
      </div>
      {terms.length > 0 ? <p className="mt-3 text-xs text-gray-500">Terms: {terms.join("; ")}.</p> : null}
    </div>
  );
}
StagesSection.displayName = "StagesSection";

export function BuyingListSection({ lines }: { lines: BuyingListLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <SectionHeading>Your buying list</SectionHeading>
      <p className="mb-3 text-sm text-gray-600">This is a labour-only job. You buy these materials; the quantities come from the measured drawings.</p>
      <div className="overflow-hidden rounded-lg border border-line">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell align="right">Quantity</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {lines.map((line, i) => (
              <TableRow key={`${line.description}-${i}`}>
                <TableCell>
                  <p className="text-gray-800">{line.description}</p>
                  {line.section ? <p className="text-xs text-gray-400">{line.section}</p> : null}
                </TableCell>
                <TableCell align="right" className="tabular-nums text-gray-700">
                  {line.qty} {line.unit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
BuyingListSection.displayName = "BuyingListSection";
