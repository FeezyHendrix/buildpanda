import { ClipboardCheck, Compass, Flag, HardHat, type LucideIcon } from "lucide-react";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { owners, type OwnerPhaseId } from "@/content/owners";

const { process } = owners;

const icons: Record<OwnerPhaseId, LucideIcon> = {
  inception: Compass,
  construction: HardHat,
  inspections: ClipboardCheck,
  completion: Flag,
};

/** How we manage: the phases of the managed service, in order, on textured beige. */
export function OwnersProcess() {
  return (
    <Section theme="light" className="relative bg-card-soft">
      <div aria-hidden="true" className="grain grain-soft" />

      <div className="site-container relative py-16 lg:pt-24 lg:pb-28">
        <div className="mx-auto flex max-w-[40rem] flex-col items-center text-center">
          <EyebrowPill className="bg-ink/8">{process.eyebrow}</EyebrowPill>
          <h2 className="mt-4 text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            {process.headline}
          </h2>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:mt-16">
          {process.phases.map((phase) => {
            const Icon = icons[phase.id];

            return (
              <li key={phase.id} className="bg-white p-6">
                <span className="flex size-9 items-center justify-center bg-brand text-white">
                  <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </span>
                <h3 className="mt-4 text-[1.0625rem] font-semibold">{phase.title}</h3>
                <p className="mt-1.5 text-sm leading-normal text-pretty text-ink-soft">{phase.description}</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {phase.points.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      {/* A square bullet, set level with the first line of its text. */}
                      <span aria-hidden="true" className="mt-[0.4375rem] size-2 shrink-0 bg-brand" />
                      {point}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}
