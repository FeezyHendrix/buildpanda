import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const PRECON_STEPS = [
  { key: "measure", label: "Measure", hint: "Panda AI reads the drawings" },
  { key: "review", label: "Review", hint: "Verify every line" },
  { key: "programme", label: "Programme", hint: "Sequence the work, verify durations" },
  { key: "output", label: "Output", hint: "Export or apply to the proposal" },
] as const;
export type PreconStepKey = (typeof PRECON_STEPS)[number]["key"];
export interface PreconStep {
  key: PreconStepKey;
  label: string;
  hint: string;
}

// A hand take-off has no review step: the person drawing the line is its
// verifier, so measuring and reviewing are the same act on the sheet.
export const MANUAL_PRECON_STEPS: readonly PreconStep[] = [
  { key: "measure", label: "Measure (draw)", hint: "Draw every line on the sheets" },
  { key: "programme", label: "Programme", hint: "Sequence the work, verify durations" },
  { key: "output", label: "Output", hint: "Export or apply to the proposal" },
];

interface Props {
  steps: readonly PreconStep[];
  active: PreconStepKey;
  reachable: ReadonlySet<PreconStepKey>;
  onSelect: (step: PreconStepKey) => void;
}

export function PreconStepper({ steps, active, reachable, onSelect }: Props) {
  const activeIndex = steps.findIndex((s) => s.key === active);
  return (
    <nav aria-label="Take-off steps" className="flex items-center gap-2 border-b border-gray-200 pb-3">
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const current = step.key === active;
        const clickable = reachable.has(step.key) && !current;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {index > 0 ? <span className={cn("h-px w-8", done || current ? "bg-primary-300" : "bg-gray-200")} /> : null}
            <button
              type="button"
              disabled={!clickable}
              aria-current={current ? "step" : undefined}
              onClick={() => onSelect(step.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1 text-left outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-gray-900/10",
                clickable && "hover:bg-gray-50",
                !clickable && !current && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  done
                    ? "bg-primary-500 text-white"
                    : current
                      ? "border-2 border-primary-500 text-primary-600"
                      : "border-2 border-gray-200 text-gray-400",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className="flex flex-col">
                <span className={cn("text-xs font-semibold", current ? "text-primary-700" : done ? "text-gray-900" : "text-gray-400")}>
                  {step.label}
                </span>
                <span className="hidden text-[11px] text-gray-400 sm:block">{step.hint}</span>
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
PreconStepper.displayName = "PreconStepper";
