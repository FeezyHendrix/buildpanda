import { lazy, Suspense } from "react";
import { Spinner } from "@/components/atoms/spinner";
import type { WorkbookPanelProps } from "./workbook-panel";

export type { WorkbookPanelProps } from "./workbook-panel";
export type { SourceAction } from "./source-action";

/**
 * The workbook's only entry point, and the reason the spreadsheet engine is not
 * in the application's main bundle.
 *
 * Univer is roughly thirteen megabytes unminified. Importing `workbook-panel`
 * anywhere eagerly — a route, a barrel file, a type import that TypeScript
 * cannot erase — puts all of it in front of every user who opens BuildPanda,
 * including the ones who never open a take-off. This `lazy` boundary is what
 * keeps it in a chunk of its own, fetched the first time somebody actually asks
 * for the Workbook.
 */
const Panel = lazy(() => import("./workbook-panel").then((module) => ({ default: module.WorkbookPanel })));

export function PreconWorkbook(props: WorkbookPanelProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-line bg-surface">
          <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
            <Spinner size="sm" />
            Opening the workbook…
          </span>
        </div>
      }
    >
      <Panel {...props} />
    </Suspense>
  );
}
PreconWorkbook.displayName = "PreconWorkbook";
