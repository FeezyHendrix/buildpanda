import { useMemo } from "react";
import type { DrawingMarkup } from "@/api/drawing-markup";
import type { Markup } from "./plan-review-markup";
import { toLocalMarkup, type Pin } from "./plan-review-types";

export interface PersistedMarkup {
  /** Server markup split into the stage's local shapes. */
  pins: Pin[];
  markups: Markup[];
  /** The server records behind those shapes, by id. */
  byId: ReadonlyMap<string, DrawingMarkup>;
  /** Resolved, or raised on a superseded revision — drawn faded, as the field app does. */
  dimmedIds: ReadonlySet<string>;
}

const NONE: DrawingMarkup[] = [];

/** The persisted markup for the sheet on screen, in the shapes the stage draws and the records the thread reads. */
export function usePersistedMarkup(server: DrawingMarkup[] | undefined): PersistedMarkup {
  const list = server ?? NONE;
  return useMemo(() => {
    const local = toLocalMarkup(list);
    return {
      pins: local.pins,
      markups: local.markups,
      byId: new Map(list.map((m) => [m.id, m])),
      dimmedIds: new Set(list.filter((m) => m.resolvedAt !== null || !m.isCurrentRevision).map((m) => m.id)),
    };
  }, [list]);
}
