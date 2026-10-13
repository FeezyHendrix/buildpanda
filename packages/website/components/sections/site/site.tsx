import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { siteSection } from "@/content/site-section";
import { InspectionCard } from "./inspection-card";
import { PhotoCard } from "./photo-card";
import { SiteFeatures } from "./site-features";

/** Site construction: reported progress backed by photos, inspections and independent verification. */
export function Site() {
  const { headline } = siteSection;

  return (
    <Section theme="light">
      <div className="site-container grid gap-y-14 py-16 lg:grid-cols-[minmax(0,545fr)_minmax(0,540fr)] lg:items-end lg:gap-x-[clamp(3rem,8vw,7.25rem)] lg:pt-26 lg:pb-28">
        <div>
          <EyebrowPill>{siteSection.eyebrow}</EyebrowPill>
          <h2 className="mt-4 text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            {headline.lead} <span className="text-brand">{headline.accent}</span>
          </h2>
          <p className="mt-5 max-w-[33rem] leading-normal text-pretty md:text-[1.0625rem]">{siteSection.body}</p>

          <div className="mt-10">
            <SiteFeatures />
          </div>
        </div>

        {/* The product cards lead on small screens, as in the mobile design. */}
        <div className="order-first flex flex-col gap-5 lg:order-none">
          <PhotoCard />
          <InspectionCard />
        </div>
      </div>
    </Section>
  );
}
