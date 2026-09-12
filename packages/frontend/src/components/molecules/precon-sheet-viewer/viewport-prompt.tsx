import { Button } from "@/components/atoms/button";
import type { SheetViewport } from "@/api/precon";
import { mmPerPtForRatio } from "@/lib/precon-meta";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

/** A dragged box waiting for its scale, by ratio or by two points a known distance apart inside it. */
export interface ViewportDraft {
  rect: [number, number, number, number];
  label: string;
  mode: "ratio" | "points";
  ratio: string;
  /** Distance in sheet points between the two calibration clicks, once both are down. */
  ptLength: number | null;
  mm: string;
}

const INPUT = cn(INPUT_SM_CLASS, "w-auto");

export function newViewportDraft(rect: [number, number, number, number], existing: number): ViewportDraft {
  return { rect, label: `Detail ${existing + 1}`, mode: "ratio", ratio: "", ptLength: null, mm: "" };
}

/** The scale the draft describes, or null while it is incomplete or nonsense. */
export function viewportScaleOf(draft: ViewportDraft): number | null {
  if (draft.mode === "ratio") {
    const ratio = Number(draft.ratio);
    return Number.isFinite(ratio) && ratio > 0 ? mmPerPtForRatio(ratio) : null;
  }
  const mm = Number(draft.mm);
  return draft.ptLength && draft.ptLength > 0 && Number.isFinite(mm) && mm > 0 ? mm / draft.ptLength : null;
}

export function viewportFromDraft(draft: ViewportDraft, scaleMmPerPt: number): SheetViewport {
  return { id: `vp_${Date.now().toString(36)}`, label: draft.label.trim() || "Detail", rect: draft.rect, scaleMmPerPt };
}

interface Props {
  draft: ViewportDraft;
  saving: boolean;
  onChange: (patch: Partial<ViewportDraft>) => void;
  onSave: () => void;
  onDiscard: () => void;
}

/** After a box is dragged with the Viewport tool: name it and give it a scale. */
export function ViewportPromptBanner({ draft, saving, onChange, onSave, onDiscard }: Props) {
  const canSave = viewportScaleOf(draft) !== null;
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSave) onSave();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-primary-100 bg-primary-50 px-3 py-1.5 text-xs text-primary-800">
      <span>Viewport</span>
      <input autoFocus className={cn(INPUT, "w-28")} value={draft.label} onChange={(e) => onChange({ label: e.target.value })} onKeyDown={onEnter} aria-label="Viewport label" />
      {draft.mode === "ratio" ? (
        <>
          <span>is drawn at 1:</span>
          <input className={cn(INPUT, "w-16")} inputMode="numeric" placeholder="20" value={draft.ratio} onChange={(e) => onChange({ ratio: e.target.value })} onKeyDown={onEnter} aria-label="Scale ratio" />
          <button type="button" className="underline" onClick={() => onChange({ mode: "points", ptLength: null })}>
            or draw a known dimension inside it
          </button>
        </>
      ) : draft.ptLength === null ? (
        <>
          <span>— click two points inside it a known distance apart</span>
          <button type="button" className="underline" onClick={() => onChange({ mode: "ratio" })}>
            type a ratio instead
          </button>
        </>
      ) : (
        <>
          <span>— these two points are</span>
          <input autoFocus className={cn(INPUT, "w-24")} inputMode="decimal" placeholder="1200" value={draft.mm} onChange={(e) => onChange({ mm: e.target.value })} onKeyDown={onEnter} aria-label="Real distance in millimetres" />
          <span>mm apart</span>
          <button type="button" className="underline" onClick={() => onChange({ ptLength: null })}>
            redraw
          </button>
        </>
      )}
      <Button size="sm" loading={saving} disabled={!canSave} onClick={onSave}>
        Save viewport
      </Button>
      <button type="button" className="underline" onClick={onDiscard}>
        Discard
      </button>
    </div>
  );
}
ViewportPromptBanner.displayName = "ViewportPromptBanner";
