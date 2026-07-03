const DELIVERABLES = [
  "Work order verification: completions cross-checked against chat evidence, photos, and measurements",
  "Delivery reconciliation: quantities received checked against orders and invoices",
  "Scope change detection: variations in chat flagged against formal change orders raised",
  "Schedule slippage: planned vs actual progress mapped — delays and sequencing gaps surfaced",
  "Attendance discrepancies: site logs reconciled against what was billed",
  "Leakage quantified against your own data — not a generic benchmark",
] as const;

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-[#004DE7]" aria-hidden="true">
      <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeOpacity="0.2" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BillingAuditCard() {
  return (
    <div className="mt-6 rounded-[16px] border border-[#004DE7]/10 bg-[#F0F4FF] px-6 py-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
        <div className="flex-1">
          <span className="inline-block rounded-full bg-[#004DE7]/10 px-3 py-0.5 text-xs font-semibold text-[#004DE7]">
            Billing Audit
          </span>
          <h2 className="mt-3 text-lg font-semibold text-gray-900">
            Find where your margin is leaking — before it's too late
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            A one-time paid engagement. Share a full data export for one active project — WhatsApp
            history, Excel trackers, schedule, and documents — and we run it through our extraction
            pipeline and review it manually. You get a structured findings report across every
            key leakage lever, plus a walkthrough call with your team.
          </p>
          <p className="mt-3 text-xs font-medium text-gray-500">
            Standalone engagement — no subscription required.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
          <ul className="flex flex-col gap-2.5">
            {DELIVERABLES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="mailto:hello@buildpanda.co?subject=Billing Audit Request"
            className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-[#004DE7] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#003cc4]"
          >
            Request a Billing Audit
          </a>
        </div>
      </div>
    </div>
  );
}
