import { CheckIcon, ShieldCheckIcon, DocumentIcon } from "@/components/icons";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_10px_30px_rgba(13,19,33,0.05)]">
      {children}
    </div>
  );
}

function PaymentsMock() {
  const rows = [
    { label: "Foundation", state: "Paid" },
    { label: "Substructure", state: "Paid" },
    { label: "Framing & roofing", state: "Awaiting sign-off" },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Payment schedule</span>
        <span className="text-xs font-medium text-muted">3 milestones</span>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${r.state === "Paid" ? "bg-success text-white" : "bg-surface-muted text-muted"}`}>
                {r.state === "Paid" ? <CheckIcon className="h-3.5 w-3.5" /> : null}
              </span>
              <span className="text-sm text-ink">{r.label}</span>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.state === "Paid" ? "bg-success-soft text-success" : "bg-brand-soft text-brand"}`}>
              {r.state}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function BudgetMock() {
  const bars = [
    { label: "Structure", pct: 78 },
    { label: "Finishing", pct: 42 },
    { label: "Services", pct: 60 },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Budget vs spend</span>
        <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">On budget</span>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink">{b.label}</span>
              <span className="text-muted">{b.pct}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function InspectionsMock() {
  const items = [
    { label: "Foundation inspection", pass: true },
    { label: "Reinforcement check", pass: true },
    { label: "Roofing inspection", pass: false },
  ];
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-5 w-5 text-success" />
        <span className="text-sm font-semibold text-ink">Independent inspections</span>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {items.map((i) => (
          <div key={i.label} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
            <span className="text-sm text-ink">{i.label}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${i.pass ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
              {i.pass ? "Passed" : "Scheduled"}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function DocumentsMock() {
  const docs = ["Architectural drawings.pdf", "Building permit.pdf", "Main contract.pdf", "Receipts - Q2.zip"];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Project documents</span>
        <span className="text-xs font-medium text-muted">{docs.length} files</span>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {docs.map((d) => (
          <div key={d} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <DocumentIcon className="h-4 w-4" />
            </span>
            <span className="text-sm text-ink">{d}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function ProposalsMock() {
  const lines = [
    { label: "Substructure", value: "₦22,300,000" },
    { label: "Superstructure", value: "₦47,158,750" },
    { label: "Finishes", value: "₦31,000,000" },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Proposal · BP-0005</span>
        <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">Accepted</span>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
            <span className="text-sm text-ink">{l.label}</span>
            <span className="text-sm font-medium text-ink">{l.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-soft px-3 py-2.5">
        <span className="text-sm font-semibold text-brand">Estimate total</span>
        <span className="text-sm font-bold text-brand">₦100,458,750</span>
      </div>
    </Frame>
  );
}

export function ProductMock({ id }: { id: string }) {
  switch (id) {
    case "preconstruction":
      return <ProposalsMock />;
    case "payments":
      return <PaymentsMock />;
    case "budget":
      return <BudgetMock />;
    case "inspections":
      return <InspectionsMock />;
    case "documents":
      return <DocumentsMock />;
    default:
      return <PaymentsMock />;
  }
}
