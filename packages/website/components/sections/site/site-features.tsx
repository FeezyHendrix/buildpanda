import { BadgeCheck, Camera, ClipboardCheck, type LucideIcon } from "lucide-react";
import { siteSection, type SiteFeatureId } from "@/content/site-section";

const icons: Record<SiteFeatureId, LucideIcon> = {
  updates: Camera,
  inspections: ClipboardCheck,
  verification: BadgeCheck,
};

/** The three things the section promises, as one bordered block. */
export function SiteFeatures() {
  return (
    <ul className="border border-line">
      {siteSection.features.map((feature) => {
        const Icon = icons[feature.id];

        return (
          <li key={feature.id} className="border-line p-6 not-first:border-t">
            <span className="flex size-9 items-center justify-center bg-brand text-white">
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </span>
            <h3 className="mt-3 text-[1.0625rem] font-semibold">{feature.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-normal text-pretty text-ink-soft">{feature.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
