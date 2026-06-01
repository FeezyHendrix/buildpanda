import { CheckIcon, WalletIcon, ShieldCheckIcon } from "@/components/icons";

const milestones = [
  { label: "Foundation", done: true },
  { label: "Substructure", done: true },
  { label: "Framing & roofing", done: false, active: true },
  { label: "Finishing & handover", done: false },
];

export function HeroVisual() {
  return (
    <div className="relative">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_24px_60px_rgba(13,19,33,0.10)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted">Project</p>
            <p className="text-sm font-semibold text-ink">4-Bedroom Duplex, Lekki</p>
          </div>
          <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            On track
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted">Overall progress</span>
            <span className="font-semibold text-ink">62%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full w-[62%] rounded-full bg-brand" />
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          {milestones.map((m) => (
            <div
              key={m.label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                m.active ? "border-brand bg-brand-soft" : "border-line bg-white"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                  m.done
                    ? "bg-success text-white"
                    : m.active
                      ? "bg-brand text-white"
                      : "bg-surface-muted text-muted"
                }`}
              >
                {m.done ? <CheckIcon className="h-3.5 w-3.5" /> : null}
              </span>
              <span
                className={`text-sm ${m.active ? "font-semibold text-ink" : "text-muted"}`}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-6 -left-4 hidden w-56 rounded-2xl border border-line bg-white p-4 shadow-[0_16px_40px_rgba(13,19,33,0.12)] sm:block">
        <div className="flex items-center gap-2 text-brand">
          <WalletIcon className="h-5 w-5" />
          <span className="text-xs font-semibold text-ink">Next milestone payment</span>
        </div>
        <p className="mt-2 text-lg font-bold text-ink">Released on approval</p>
        <p className="text-xs text-muted">Funds move only when verified work is signed off.</p>
      </div>

      <div className="absolute -right-3 -top-5 hidden items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-[0_16px_40px_rgba(13,19,33,0.12)] sm:flex">
        <ShieldCheckIcon className="h-5 w-5 text-success" />
        <span className="text-xs font-semibold text-ink">Inspection passed</span>
      </div>
    </div>
  );
}
