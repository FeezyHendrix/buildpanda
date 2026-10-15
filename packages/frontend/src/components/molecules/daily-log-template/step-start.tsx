import { ImageTextarea } from "@/components/molecules/image-textarea";
import { ContentText } from "@/components/molecules/rich-content";
import { ClipboardList, FilePlus2, ListChecks, type LucideIcon } from "lucide-react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";

export type StartingPoint = "diary" | "quick" | "blank";

const STARTING_POINTS: { id: StartingPoint; title: string; body: string; icon: LucideIcon }[] = [
  { id: "diary", title: "Full site diary", body: "Weather, manpower, progress, safety and issues. 10 questions, ready to adjust.", icon: ClipboardList },
  { id: "quick", title: "Quick daily check", body: "Five questions a crew lead answers in a minute at the end of the day.", icon: ListChecks },
  { id: "blank", title: "Start from scratch", body: "An empty form. Add exactly the questions you want.", icon: FilePlus2 },
];

interface StepStartProps {
  name: string;
  description: string;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  /** Omitted when editing: an existing form keeps its questions. */
  start?: { value: StartingPoint; onChange: (value: StartingPoint) => void };
}

/** Step 1: what the form is called and what it starts from. */
export function StepStart({ name, description, onName, onDescription, start }: StepStartProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 sm:px-8">
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Name your form</h3>
          <p className="mt-1 text-sm text-gray-500">This is what your team picks when they fill in the day&apos;s log.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiz-name">Form name</Label>
          <input id="wiz-name" value={name} autoFocus placeholder="e.g. Site diary" maxLength={120} onChange={(e) => onName(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiz-description">When should the team use it? (optional)</Label>
          <ImageTextarea id="wiz-description" value={description} placeholder="e.g. Fill in before leaving site each day" maxLength={1000} onChange={(e) => onDescription(e.target.value)} className={INPUT_CLASS} />
        </div>
      </section>

      {start ? (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pick a starting point</h3>
            <p className="mt-1 text-sm text-gray-500">You can change every question in the next step.</p>
          </div>
          <div role="radiogroup" aria-label="Starting point" className="grid gap-3 sm:grid-cols-3">
            {STARTING_POINTS.map((point) => {
              const chosen = start.value === point.id;
              const Icon = point.icon;
              return (
                <button
                  key={point.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => start.onChange(point.id)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/30",
                    chosen ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500/20" : "border-line bg-white hover:border-line-hover",
                  )}
                >
                  <Icon className={cn("size-6", chosen ? "text-primary-500" : "text-gray-400")} aria-hidden />
                  <span className="text-sm font-semibold text-gray-900">{point.title}</span>
                  <span className="text-xs text-gray-500"><ContentText value={point.body} /></span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

StepStart.displayName = "StepStart";
