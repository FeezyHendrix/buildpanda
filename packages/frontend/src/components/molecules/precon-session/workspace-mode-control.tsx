import { Columns2, PencilRuler, Table2 } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { WORKBOOK_MODES, type WorkspaceMode } from "./workspace-mode";

const MODE_META: Readonly<Record<WorkspaceMode, { label: string; Icon: typeof Table2 }>> = {
  workbook: { label: "Workbook", Icon: Table2 },
  drawings: { label: "Drawings", Icon: PencilRuler },
  split: { label: "Split", Icon: Columns2 },
};

interface Props {
  mode: WorkspaceMode;
  /** False when the window is too narrow for two usable panes. */
  splitAvailable: boolean;
  onChange: (mode: WorkspaceMode) => void;
}

const BLOCKED_REASON = "Not enough room to show both panes";

/**
 * The compact Workbook / Drawings / Split control.
 *
 * Labels stay visible at EVERY width, phones included — icon-only was reviewed
 * and rejected as unreadable. Split also stays visible and focusable when there
 * is no room for it, carrying `aria-disabled` and its reason.
 */
export function WorkspaceModeControl({ mode, splitAvailable, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="What to show"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-none bg-surface-alt p-0.5"
    >
      {WORKBOOK_MODES.map((candidate) => {
        const { label, Icon } = MODE_META[candidate];
        const blocked = candidate === "split" && !splitAvailable;
        return (
          <Button
            key={candidate}
            type="button"
            size="sm"
            variant={mode === candidate ? "primary" : "ghost"}
            aria-pressed={mode === candidate}
            aria-disabled={blocked || undefined}
            title={blocked ? BLOCKED_REASON : label}
            className={cn(
              "gap-1.5",
              // Not `opacity-50` — at this size that drops the label under the
              // 4.5:1 contrast floor. The reason is spelled out beside it.
              blocked && "text-ink-disabled",
            )}
            onClick={() => {
              if (!blocked) onChange(candidate);
            }}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
WorkspaceModeControl.displayName = "WorkspaceModeControl";
