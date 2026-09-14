import { useCallback, useState } from "react";
import type { DrawingMarkup } from "@/api/drawing-markup";
import type { MarkupGeometry, MarkupKind } from "@/components/plan-review/markup-types";
import type { Db } from "@/db/client";
import { drawingMarkupsRepository } from "@/db/drawing-markups-repository";

interface UndoEntry {
  id: string;
  kind: MarkupKind;
  geometry: MarkupGeometry;
}

/** The shape without its `space`, so a row the outbox re-wrote still matches what was drawn. */
function shapeKey(kind: MarkupKind, geometry: MarkupGeometry): string {
  const { space: _space, ...shape } = geometry;
  return `${kind}:${JSON.stringify(shape)}`;
}

/**
 * One step of undo over the markups created in this session, one stack per
 * sheet page. In memory only: undo is a slip of the finger caught within
 * seconds, not a record, and a markup that survived a page change is a
 * markup someone meant. Deleting a markup that has already reached the
 * server goes through the outbox like any other delete.
 */
export function useMarkupUndo(db: Db, projectId: string, pageKey: string | null) {
  const [stacks, setStacks] = useState<Record<string, UndoEntry[]>>({});
  const stack = pageKey ? (stacks[pageKey] ?? []) : [];

  const push = useCallback(
    (entry: UndoEntry) => {
      if (!pageKey) return;
      setStacks((s) => ({ ...s, [pageKey]: [...(s[pageKey] ?? []), entry] }));
    },
    [pageKey],
  );

  /**
   * Remove the last markup created on this page. `current` is the page as it
   * is now: a `local_` id may have become a server id once the outbox pushed
   * it, in which case the row is found again by what was drawn.
   */
  const undo = useCallback(
    async (current: DrawingMarkup[]): Promise<boolean> => {
      if (!pageKey) return false;
      const entry = stack[stack.length - 1];
      if (!entry) return false;
      setStacks((s) => ({ ...s, [pageKey]: (s[pageKey] ?? []).slice(0, -1) }));

      let id: string | null = (await drawingMarkupsRepository.findById(db, entry.id)) ? entry.id : null;
      if (!id) {
        const wanted = shapeKey(entry.kind, entry.geometry);
        id = current.find((m) => shapeKey(m.kind, m.geometry) === wanted)?.id ?? null;
      }
      if (!id) return false;
      if (id.startsWith("local_")) await drawingMarkupsRepository.removeLocal(db, id);
      else await drawingMarkupsRepository.deleteLocal(db, projectId, id);
      return true;
    },
    [db, projectId, pageKey, stack],
  );

  return { canUndo: stack.length > 0, push, undo };
}
