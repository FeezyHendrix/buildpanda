import { useEffect, useRef } from "react";
import { createWorkbookEngine, type EngineCallbacks, type WorkbookEngine } from "./univer-engine";
import type { WorkbookDocument, WorkbookLayout } from "@/api/workbook-types";

interface Props {
  document: WorkbookDocument;
  layout: () => WorkbookLayout;
  callbacks: EngineCallbacks;
  onReady: (engine: WorkbookEngine) => void;
}

/**
 * The canvas the engine draws on, and nothing else.
 *
 * It mounts ONCE per workbook document identity and is never re-rendered into:
 * the engine owns the DOM inside `container`, and React re-entering it would
 * tear the canvas out from under a user mid-edit. Fresh server figures reach
 * the grid through `engine.applySourceCells`, not through a remount.
 */
export function WorkbookGrid({ document, layout, callbacks, onReady }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const live = useRef<EngineCallbacks>(callbacks);
  live.current = callbacks;

  useEffect(() => {
    const host = container.current;
    if (!host) return;

    const engine = createWorkbookEngine({
      container: host,
      document,
      layout,
      callbacks: {
        onDirty: () => live.current.onDirty(),
        onRefused: (refusal) => live.current.onRefused(refusal),
        onFocusChanged: (focus) => live.current.onFocusChanged(focus),
      },
    });
    onReady(engine);

    // Univer sizes its canvas from the container, so a pane that changes width
    // — the split control, a phone rotating — must tell it, or the sheet is
    // left rendering into a box that no longer exists.
    const observer = new ResizeObserver(() => engine.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      engine.dispose();
    };
    // Deliberately keyed on the workbook's identity alone. `layout` and
    // `callbacks` are read through refs precisely so a new document VERSION
    // never rebuilds the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.sessionId]);

  return <div ref={container} className="min-h-0 flex-1 [&_*]:font-sans" data-workbook-grid />;
}
WorkbookGrid.displayName = "WorkbookGrid";
