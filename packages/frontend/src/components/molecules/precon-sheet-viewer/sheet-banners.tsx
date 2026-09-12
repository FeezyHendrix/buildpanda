import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

export interface ScalePrompt {
  ptLength: number;
  mm: string;
}

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

/** After two points are drawn: ask how far apart they really are. */
export function ScalePromptBanner({
  prompt,
  saving,
  onChange,
  onApply,
  onRedraw,
}: {
  prompt: ScalePrompt;
  saving: boolean;
  onChange: (mm: string) => void;
  onApply: () => void;
  onRedraw: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-primary-100 bg-primary-50 px-3 py-1.5 text-xs text-primary-800">
      <span>These two points are</span>
      <input
        autoFocus
        className={cn(INPUT_SM_CLASS, "w-24")}
        inputMode="decimal"
        placeholder="4000"
        value={prompt.mm}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onApply();
        }}
      />
      <span>mm apart</span>
      <Button size="sm" loading={saving} onClick={onApply}>
        Set scale
      </Button>
      <button type="button" className="underline" onClick={onRedraw}>
        Redraw
      </button>
    </div>
  );
}
ScalePromptBanner.displayName = "ScalePromptBanner";
