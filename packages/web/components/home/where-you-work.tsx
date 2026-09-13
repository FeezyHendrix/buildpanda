import { Container } from "@/components/ui";
import {
  GlobeIcon,
  MilestoneIcon,
  WalletIcon,
  LayersIcon,
} from "@/components/icons";

// Only four rows, and every one of them is something the product does today.
// The deck's language row is not here: there is no i18n in the product, so the
// site says nothing about Arabic, right-to-left or multiple languages. The
// data-residency row is not here either: region choice is not implemented. And
// no measurement standard is named by initials, because none of them have been
// verified item by item.
const rows = [
  {
    icon: <GlobeIcon className="h-6 w-6" />,
    title: "Your currency",
    body: "Price, certify and report in the money the contract is written in, not a converted figure.",
  },
  {
    icon: <MilestoneIcon className="h-6 w-6" />,
    title: "Your working calendar",
    body: "Set the working week and holidays per project, so “days late” means what it should.",
  },
  {
    icon: <WalletIcon className="h-6 w-6" />,
    title: "Payment applications your contract recognises",
    body: "Interim applications structured the way FIDIC contracts expect, with retention and advance recovery.",
  },
  {
    icon: <LayersIcon className="h-6 w-6" />,
    title: "Work libraries for what you actually build",
    body: "One library for building, one for roads and civils. A road job is offered the road library by default.",
  },
];

export function WhereYouWork() {
  return (
    <section className="bg-ink py-16 sm:py-20">
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            How it works where you work
          </span>
          <h2 className="max-w-2xl text-balance text-3xl font-bold leading-tight text-white sm:text-4xl">
            Your currency, your working week, your contract.
          </h2>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
            Not an American product with a currency dropdown bolted on.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.title}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 2xl:p-8"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">
                {row.icon}
              </span>
              <h3 className="text-lg font-semibold leading-snug text-white 2xl:text-xl">
                {row.title}
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-white/70 2xl:text-base">
                {row.body}
              </p>
            </div>
          ))}
        </div>

      </Container>
    </section>
  );
}
