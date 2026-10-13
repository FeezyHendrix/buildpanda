import { FileUp, Sparkles, Table2, type LucideIcon } from "lucide-react";
import { takeoff, type StepId } from "@/content/takeoff";

const icons: Record<StepId, LucideIcon> = {
  upload: FileUp,
  analyse: Sparkles,
  sheet: Table2,
};

/** The three steps, as one white strip under the visual. */
export function TakeoffSteps() {
  return (
    <ol className="grid bg-white text-ink md:grid-cols-3">
      {takeoff.steps.map((step) => {
        const Icon = icons[step.id];

        return (
          <li key={step.id} className="border-line p-6 not-first:border-t md:not-first:border-t-0 md:not-first:border-l">
            <span className="flex size-8 items-center justify-center bg-brand text-white">
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
            </span>
            <h3 className="mt-4 text-[0.9375rem] font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-normal text-pretty text-ink-soft">{step.description}</p>
          </li>
        );
      })}
    </ol>
  );
}
