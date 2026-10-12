import { useDroppable } from "@dnd-kit/core";
import { SortableContext as BaseSortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, MousePointerClick, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ICON_BUTTON } from "./field-properties";
import { FIELD_TYPE_META, type DraftField } from "./field-types";

// Workaround for React 19 type issue with dnd-kit, as on the task board.
const SortableContext = BaseSortableContext as unknown as (props: { items: string[]; strategy: typeof verticalListSortingStrategy; children: ReactNode }) => ReactNode;

/** Droppable id for the open space below the last field. */
export const CANVAS_END = "canvas:end";

/** One line of what the field asks for, so the form reads like the real thing. */
function summary(field: DraftField): string | null {
  if (field.type === "select") {
    const options = (field.options ?? []).map((o) => o.trim()).filter(Boolean);
    return options.length ? options.join(" · ") : "No options yet";
  }
  if (field.type === "number") return field.unit ? `Number, in ${field.unit}` : "Number";
  if (field.type === "section") return null;
  return FIELD_TYPE_META[field.type].label;
}

export interface CanvasActions {
  onSelect: (key: string) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
}

function DropLine() {
  return <div className="h-1 rounded-full bg-primary-500" aria-hidden />;
}

function FieldCard({ field, index, selected, actions, insertBefore, children }: {
  field: DraftField;
  index: number;
  selected: boolean;
  actions: CanvasActions;
  insertBefore: boolean;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta.icon;
  const isSection = field.type === "section";
  const detail = summary(field);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex flex-col gap-2", isDragging && "z-10 opacity-50")}>
      {insertBefore ? <DropLine /> : null}
      <div
        className={cn(
          "group rounded-xl border bg-white transition-colors",
          isSection && "bg-surface-alt",
          selected ? "border-primary-500 ring-2 ring-primary-500/20" : "border-line hover:border-line-hover",
        )}
      >
        <div className="flex items-center gap-1 p-2">
          <button
            ref={setActivatorNodeRef}
            type="button"
            className={cn(ICON_BUTTON, "cursor-grab touch-none active:cursor-grabbing")}
            aria-label={`Reorder ${field.label || meta.label}. Press space to pick up, arrows to move.`}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" />
          </button>
          <button type="button" onClick={() => actions.onSelect(field.key)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30">
            <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate", isSection ? "text-sm font-semibold uppercase tracking-wide text-gray-600" : "text-sm font-medium text-gray-900", !field.label && "italic text-gray-400")}>
                {field.label || (isSection ? "Untitled section" : "Untitled question")}
                {field.required ? <span className="text-red-500"> *</span> : null}
              </span>
              {detail ? <span className="block truncate text-xs text-gray-400">{detail}</span> : null}
            </span>
          </button>
          <span className="hidden text-xs tabular-nums text-gray-300 sm:block" aria-hidden>{index + 1}</span>
          <button type="button" className={ICON_BUTTON} aria-label="Duplicate field" onClick={() => actions.onDuplicate(field.key)}>
            <Copy className="size-4" />
          </button>
          <button type="button" className={cn(ICON_BUTTON, "hover:bg-red-50 hover:text-red-600")} aria-label="Delete field" onClick={() => actions.onRemove(field.key)}>
            <Trash2 className="size-4" />
          </button>
        </div>
        {children ? <div className="border-t border-line p-4">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * The form as the crew will see it, top to bottom. Fields reorder by their
 * handle (mouse, touch or keyboard); new ones drop in from the palette, with a
 * line showing where they will land.
 */
export function FormCanvas({ drafts, selectedKey, actions, dropTarget, renderInline }: {
  drafts: DraftField[];
  selectedKey: string | null;
  actions: CanvasActions;
  /** Where a field dragged from the palette would land, while one is in the air. */
  dropTarget: string | null;
  /** Narrow screens edit the selected field in place. */
  renderInline?: (field: DraftField) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_END });

  return (
    <div className="flex flex-col gap-2">
      <SortableContext items={drafts.map((d) => d.key)} strategy={verticalListSortingStrategy}>
        {drafts.map((field, index) => (
          <FieldCard key={field.key} field={field} index={index} selected={field.key === selectedKey} actions={actions} insertBefore={dropTarget === field.key}>
            {field.key === selectedKey ? renderInline?.(field) : null}
          </FieldCard>
        ))}
      </SortableContext>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          isOver || dropTarget === CANVAS_END ? "border-primary-500 bg-primary-50" : "border-line",
        )}
      >
        <MousePointerClick className="size-5 text-gray-300" aria-hidden />
        <p className="text-sm text-gray-500">{drafts.length ? "Drop a field here to add it at the end" : "Drag a field here to start your form"}</p>
      </div>
    </div>
  );
}

FormCanvas.displayName = "FormCanvas";
