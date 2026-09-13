import { CheckIcon, ShieldCheckIcon } from "@/components/icons";

// The deck asks the hero to show one thing: a payment certificate whose lines
// trace back to signed-off inspections. Everything here is drawn in markup so
// the first screen carries no image weight on a low-end phone.

const lines = [
  {
    ref: "INS-014",
    item: "Sub-base to Ch. 1+200 – 1+600",
    signedOff: true,
  },
  {
    ref: "INS-016",
    item: "Reinforcement, culvert 1 headwall",
    signedOff: true,
  },
  {
    ref: "INS-019",
    item: "Binder course, Ch. 0+800 – 1+200",
    signedOff: false,
  },
];

export function HeroCertificate() {
  return (
    <div className="relative">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_24px_60px_rgba(13,19,33,0.10)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted">
              Payment application 07
            </p>
            <p className="text-sm font-semibold text-ink">
              Ikorodu Road rehabilitation
            </p>
          </div>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            Ready to certify
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {lines.map((line) => (
            <div
              key={line.ref}
              className="flex items-start gap-3 rounded-xl border border-line bg-white px-3 py-2.5"
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                  line.signedOff
                    ? "bg-success text-white"
                    : "bg-surface-muted text-muted"
                }`}
              >
                {line.signedOff ? <CheckIcon className="h-3 w-3" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">{line.item}</span>
                <span className="block text-xs text-muted">
                  {line.signedOff
                    ? `Signed off on inspection ${line.ref}`
                    : `Inspection ${line.ref} attended, report pending`}
                </span>
              </span>
            </div>
          ))}
        </div>

        <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Previously certified</dt>
            <dd className="font-medium text-ink tabular-nums">₦184,300,000</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">This certificate</dt>
            <dd className="font-medium text-ink tabular-nums">₦31,750,000</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Retention held</dt>
            <dd className="font-medium text-ink tabular-nums">₦10,802,500</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-[0_8px_24px_rgba(13,19,33,0.06)]">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-success" />
          <span className="text-xs font-semibold text-ink">
            Inspection INS-016 · Pass
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Attended 11 September, report filed the same day. The contractor can
          read it and cannot change it.
        </p>
      </div>
    </div>
  );
}
