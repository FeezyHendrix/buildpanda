import { ChartNoAxesCombined, Globe, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { about, type ValueId } from "@/content/about";

const { values } = about;

const icons: Record<ValueId, LucideIcon> = {
  trust: ShieldCheck,
  money: ChartNoAxesCombined,
  distance: Globe,
  people: Users,
};

/** Our values: four cards whose content sits at the foot of each card. */
export function AboutValues() {
  return (
    <Section theme="light">
      <div className="site-container pt-14 pb-16 lg:pt-24 lg:pb-28">
        <EyebrowPill>{values.eyebrow}</EyebrowPill>
        <h2 className="mt-4 max-w-[18ch] text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
          {values.headline}
        </h2>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:mt-20 lg:grid-cols-4">
          {values.items.map((value) => {
            const Icon = icons[value.id];

            return (
              <li key={value.id} className="flex flex-col bg-card p-6 sm:min-h-60 sm:justify-end lg:min-h-[20.625rem]">
                <span className="flex size-9 items-center justify-center bg-brand text-white">
                  <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </span>
                <h3 className="mt-4 text-[1.0625rem] font-semibold">{value.title}</h3>
                <p className="mt-1.5 text-sm leading-normal text-pretty text-ink-soft">{value.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
