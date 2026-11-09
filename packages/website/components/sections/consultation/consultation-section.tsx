import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { ConsultationForm } from "@/components/sections/owners/consultation-form";

export type ConsultationCopy = {
  /** The section's anchor; buttons higher up the page scroll to it. */
  id: string;
  eyebrow: string;
  headline: string;
  body: string;
  /** Sent with the enquiry; defaults to the owners' managed service. */
  projectType?: string;
  /** Which page sent the enquiry. */
  source?: string;
};

/** Book a consultation: the invitation beside the enquiry form. Used on the owners and contractors pages. */
export function ConsultationSection({ copy }: { copy: ConsultationCopy }) {
  return (
    <Section theme="light" id={copy.id} className="scroll-mt-(--nav-height)">
      <div className="site-container grid gap-10 pt-14 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,35.375rem)] lg:gap-x-20 lg:pt-24 lg:pb-28">
        <div>
          <EyebrowPill>{copy.eyebrow}</EyebrowPill>
          <h2 className="mt-4 max-w-[9em] text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            {copy.headline}
          </h2>
          <p className="mt-4 max-w-[32.5rem] leading-normal text-pretty">{copy.body}</p>
        </div>

        <ConsultationForm projectType={copy.projectType} source={copy.source} />
      </div>
    </Section>
  );
}
