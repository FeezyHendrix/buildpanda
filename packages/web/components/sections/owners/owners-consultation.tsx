import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { owners } from "@/content/owners";
import { ConsultationForm } from "./consultation-form";

const { consultation } = owners;

/** Book a consultation: the invitation beside the enquiry form. */
export function OwnersConsultation() {
  return (
    <Section theme="light" id={consultation.id} className="scroll-mt-(--nav-height)">
      <div className="site-container grid gap-10 pt-14 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,35.375rem)] lg:gap-x-20 lg:pt-24 lg:pb-28">
        <div>
          <EyebrowPill>{consultation.eyebrow}</EyebrowPill>
          <h2 className="mt-4 max-w-[9em] text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            {consultation.headline}
          </h2>
          <p className="mt-4 max-w-[32.5rem] leading-normal text-pretty">{consultation.body}</p>
        </div>

        <ConsultationForm />
      </div>
    </Section>
  );
}
