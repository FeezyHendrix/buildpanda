import { Crosshair, Eye, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import type { useOverlaySuite } from "./use-overlay-suite";

/**
 * The Overlay tool's floating panel: which earlier sheet ghosts underneath,
 * how strongly, a blink to spot differences, and the three-point alignment
 * that turns into a `set-overlay` receipt. A view record only — quantities
 * never move from here.
 */
export function OverlayControls({ ovl }: { ovl: ReturnType<typeof useOverlaySuite> }) {
  if (!ovl.active) return null;
  const alignHint = ovl.aligning
    ? ovl.pendingSource
      ? `Pair ${ovl.pairs.length + 1}: now click the same feature on this sheet`
      : ovl.pairs.length >= 3
        ? "Three pairs captured — apply the alignment"
        : `Pair ${ovl.pairs.length + 1} of 3: click a feature on the red ghost`
    : null;
  return (
    <div className="absolute left-1/2 top-3 z-20 w-[26rem] -translate-x-1/2 rounded-none border border-line bg-white p-3 shadow-lg" data-overlay-controls>
      <div className="flex items-center gap-2">
        <p className="text-caption-l font-semibold text-ink">Revision overlay</p>
        {ovl.saving ? <Spinner size="sm" /> : null}
        {ovl.persisted ? <span className="text-caption-m text-ink-muted">saved alignment on this sheet</span> : null}
      </div>
      <label className="mt-2 block text-caption-m font-medium text-ink-muted">
        Compare against
        <select
          className="mt-0.5 w-full rounded-none border border-line px-2 py-1 text-caption-l"
          value={ovl.chosenSourceId ?? ""}
          onChange={(e) => ovl.setSourceSheetId(e.target.value || null)}
        >
          <option value="">— choose a sheet —</option>
          {ovl.sourceOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-caption-m font-medium text-ink-muted">
        Opacity · {Math.round(ovl.opacity * 100)}%
        <input
          type="range"
          aria-label="Overlay opacity"
          min={0.05}
          max={1}
          step={0.05}
          className="mt-0.5 w-full"
          value={ovl.opacity}
          onChange={(e) => ovl.setOpacity(Number(e.target.value))}
          onMouseUp={() => ovl.applyOpacityOnly()}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={ovl.toggleBlink} disabled={!ovl.render}>
          <Eye size={12} aria-hidden="true" /> {ovl.blinkOn ? "Stop blink" : "Blink"}
        </Button>
        {ovl.aligning ? (
          <>
            <Button size="sm" variant="primary" disabled={ovl.pairs.length !== 3 || ovl.saving} onClick={ovl.apply}>
              Apply alignment
            </Button>
            <Button size="sm" variant="ghost" onClick={ovl.cancelAlign}>
              <X size={12} aria-hidden="true" /> Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" disabled={!ovl.chosenSourceId} onClick={ovl.startAlign}>
            <Crosshair size={12} aria-hidden="true" /> Align (3 points)
          </Button>
        )}
        {ovl.persisted ? (
          <Button size="sm" variant="ghost" disabled={ovl.saving} onClick={ovl.reset}>
            <RotateCcw size={12} aria-hidden="true" /> Remove overlay
          </Button>
        ) : null}
      </div>
      {alignHint ? <p className="mt-1.5 text-caption-m font-medium text-primary-700">{alignHint}</p> : null}
    </div>
  );
}
OverlayControls.displayName = "OverlayControls";
