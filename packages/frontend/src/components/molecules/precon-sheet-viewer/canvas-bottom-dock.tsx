import type { ReactNode } from "react";

interface Props {
  /** The contextual bar: draft controls, saved-shape controls, pen presets or persisted undo. */
  bar: ReactNode;
  /** The view controls, which are always present and must always stay clickable. */
  view: ReactNode;
}

/**
 * The single row every floating control at the foot of the canvas lives in.
 *
 * Each bar used to place itself absolutely (`bottom-3 left-1/2`,
 * `bottom-3 right-3`), so a wide edit bar and the zoom cluster occupied the
 * same pixels and the later-painted one swallowed the other's clicks —
 * `Cancel shape edit` and `Save shape` became unreachable by mouse. Laying
 * them out as flex siblings makes an overlap impossible by construction rather
 * than by z-index, and wrapping keeps every control on screen at narrow
 * widths instead of pushing it past the canvas edge.
 */
export function CanvasBottomDock({ bar, view }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-end justify-between gap-2">
      <div className="pointer-events-auto flex min-w-0 max-w-full flex-wrap items-end gap-2">{bar}</div>
      <div className="pointer-events-auto flex max-w-full flex-wrap items-end gap-2">{view}</div>
    </div>
  );
}
CanvasBottomDock.displayName = "CanvasBottomDock";
