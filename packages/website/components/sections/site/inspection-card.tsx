import { CircleCheck } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { siteSection, type InspectionStatus } from "@/content/site-section";

const tones: Record<InspectionStatus, "success" | "warning"> = {
  pass: "success",
  observation: "warning",
};

/** An inspection record as it appears in the product: checklist results and who verified them. */
export function InspectionCard() {
  const { inspection } = siteSection;

  return (
    <article className="border border-line bg-white p-[1.125rem]">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[0.8125rem] font-semibold">{inspection.title}</h3>
        <p className="text-[0.6875rem] text-ink-soft tabular-nums">{inspection.code}</p>
      </div>

      <ul className="mt-3">
        {inspection.items.map((item) => (
          <li
            key={item.label}
            className="flex min-h-9 items-center justify-between gap-4 border-line text-[0.8125rem] not-first:border-t"
          >
            {item.label}
            <StatusPill tone={tones[item.status]}>{inspection.statusLabels[item.status]}</StatusPill>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex min-h-9 items-center gap-2 bg-info-soft px-3 py-2 text-[0.8125rem] text-info">
        <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        {inspection.verified}
      </p>
    </article>
  );
}
