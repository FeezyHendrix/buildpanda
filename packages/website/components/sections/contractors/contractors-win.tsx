import { ArrowRightLeft, FileSpreadsheet, Inbox, type LucideIcon } from "lucide-react";
import { Section } from "@/components/ui/section";
import { contractors, type ContractorWinId } from "@/content/contractors";

const { win } = contractors;

const icons: Record<ContractorWinId, LucideIcon> = {
  leads: Inbox,
  proposals: FileSpreadsheet,
  handoff: ArrowRightLeft,
};

/** Win the work: what BuildPanda does before the job is won, on textured beige. */
export function ContractorsWin() {
  return (
    <Section theme="light" className="relative bg-card-soft">
      <div aria-hidden="true" className="grain grain-soft" />

      <div className="site-container relative pt-14 pb-16 lg:py-20">
        <h2 className="text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
          {win.headline}
        </h2>
        <p className="mt-4 max-w-[37rem] leading-normal text-pretty">{win.body}</p>

        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {win.items.map((item) => {
            const Icon = icons[item.id];

            return (
              <li key={item.id} className="flex min-h-[12.75rem] flex-col justify-center bg-white p-6 lg:p-8">
                <span className="flex size-9 items-center justify-center bg-brand text-white">
                  <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em]">{item.title}</h3>
                <p className="mt-1.5 leading-normal text-pretty text-ink-soft">{item.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
