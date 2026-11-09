import { ChartNoAxesCombined, Cpu, Eye, type LucideIcon } from "lucide-react";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { owners, type OwnerBenefitId } from "@/content/owners";

const { eyes } = owners;

const icons: Record<OwnerBenefitId, LucideIcon> = {
  payments: ChartNoAxesCombined,
  management: Cpu,
  visibility: Eye,
};

/** Eyes on Ground: what an owner gets from the managed service, as three cards. */
export function OwnersEyes() {
  return (
    <Section theme="light" className="border-b border-line">
      <div className="site-container pt-14 pb-16 lg:py-24">
        <EyebrowPill>{eyes.eyebrow}</EyebrowPill>
        <h2 className="mt-4 text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em]">
          {eyes.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
        <p className="mt-4 max-w-[32rem] leading-normal text-pretty">{eyes.body}</p>

        <ul className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-16">
          {eyes.benefits.map((benefit) => {
            const Icon = icons[benefit.id];

            return (
              <li key={benefit.id} className="border border-line bg-card-soft p-6">
                <span className="flex size-9 items-center justify-center bg-brand text-white">
                  <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </span>
                <h3 className="mt-4 text-[1.0625rem] font-semibold">{benefit.title}</h3>
                <p className="mt-1.5 text-sm leading-normal text-pretty text-ink-soft">{benefit.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
