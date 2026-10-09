import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import type { ScalePrompt, ScaleUnit } from "./use-scale-prompt";

const UNITS: ScaleUnit[] = ["mm", "cm", "m"];

/** Shown when a sheet has no scale: the two ways to give it one. */
export function NoScaleBanner({ message, onOpenSettings, onDrawScale }: { message: string; onOpenSettings: () => void; onDrawScale: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-3 py-1 text-xs text-amber-700">
      {message}
      <button type="button" className="font-semibold underline" onClick={onOpenSettings}>
        Set the scale
      </button>
      <span>or</span>
      <button type="button" className="font-semibold underline" onClick={onDrawScale}>
        draw a known dimension
      </button>
    </p>
  );
}
NoScaleBanner.displayName = "NoScaleBanner";

/**
 * After two points are drawn: the stated real distance (with its unit), an
 * explicit Preview — figures are shown before anything is written — and the
 * hint that the endpoints themselves are draggable.
 */
export function ScalePromptBanner({
  prompt,
  previewing,
  error,
  onPatch,
  onPreview,
  onRedraw,
}: {
  prompt: ScalePrompt;
  previewing: boolean;
  error: string | null;
  onPatch: (changes: Partial<ScalePrompt>) => void;
  onPreview: () => void;
  onRedraw: () => void;
}) {
  return (
    <div className="border-b border-primary-100 bg-primary-50 px-3 py-1.5 text-xs text-primary-800" data-scale-prompt>
      <div className="flex flex-wrap items-center gap-2">
        <span>These two points are</span>
        <input
          autoFocus
          aria-label="Real distance between the two points"
          className={cn(INPUT_SM_CLASS, "w-24")}
          inputMode="decimal"
          placeholder="4000"
          value={prompt.distance}
          onChange={(e) => onPatch({ distance: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onPreview();
          }}
        />
        <select aria-label="Distance unit" className={cn(INPUT_SM_CLASS, "w-16")} value={prompt.unit} onChange={(e) => onPatch({ unit: e.target.value as ScaleUnit })}>
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <span>apart — drag an endpoint to correct it</span>
        <Button size="sm" loading={previewing} onClick={onPreview}>
          Preview new scale
        </Button>
        <button type="button" className="underline" onClick={onRedraw}>
          Redraw
        </button>
      </div>
      {error ? <p className="mt-1 text-red-700" data-scale-error>{error}</p> : null}
    </div>
  );
}
ScalePromptBanner.displayName = "ScalePromptBanner";
