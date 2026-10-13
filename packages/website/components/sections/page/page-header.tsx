import type { ReactNode } from "react";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";

/** The top of a text page (legal, guides, contact): eyebrow, headline, one line under it. */
export function PageHeader({ eyebrow, title, lead, meta }: { eyebrow: string; title: string; lead?: ReactNode; meta?: ReactNode }) {
  return (
    <Section theme="light" className="pt-(--nav-height)">
      <div className="site-container max-w-[48rem] pt-12 pb-10 lg:pt-20 lg:pb-14">
        <EyebrowPill>{eyebrow}</EyebrowPill>
        <h1 className="mt-4 text-[clamp(2.25rem,1.5rem+2.8vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
          {title}
        </h1>
        {lead ? <p className="mt-5 max-w-[38rem] text-[1.0625rem] leading-normal text-pretty">{lead}</p> : null}
        {meta ? <p className="mt-4 text-sm text-ink-soft">{meta}</p> : null}
      </div>
    </Section>
  );
}
