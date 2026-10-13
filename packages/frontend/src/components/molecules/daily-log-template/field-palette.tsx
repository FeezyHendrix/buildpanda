import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import type { TemplateFieldType } from "@/api/daily-log-templates";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_META, FIELD_TYPE_ORDER } from "./field-types";

/** Drag id for a new field of this type, as opposed to a field already on the form. */
export const paletteId = (type: TemplateFieldType) => `palette:${type}`;

function PaletteItem({ type, compact, onAdd }: { type: TemplateFieldType; compact: boolean; onAdd: (type: TemplateFieldType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: paletteId(type), data: { type } });
  const meta = FIELD_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <button
      ref={setNodeRef}
      type="button"
      title={`${meta.hint}. Drag onto the form, or click to add at the end.`}
      onClick={() => onAdd(type)}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border border-line bg-white text-left outline-none transition-colors",
        "hover:border-primary-300 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500/30",
        "cursor-grab active:cursor-grabbing",
        compact ? "shrink-0 px-3 py-2" : "px-3 py-2.5",
        isDragging && "opacity-40",
      )}
      {...listeners}
      {...attributes}
    >
      {!compact ? <GripVertical className="size-4 shrink-0 text-gray-300 group-hover:text-gray-400" aria-hidden /> : null}
      <Icon className="size-4 shrink-0 text-primary-500" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-800">{meta.label}</span>
        {!compact ? <span className="block text-xs text-gray-400">{meta.hint}</span> : null}
      </span>
      {compact ? <Plus className="size-3.5 text-gray-400" aria-hidden /> : null}
    </button>
  );
}

/**
 * The field types to build from. A side column on wide screens; a row of chips
 * above the form on narrow ones.
 */
export function FieldPalette({ compact = false, onAdd }: { compact?: boolean; onAdd: (type: TemplateFieldType) => void }) {
  return (
    <div className={compact ? "flex gap-2 overflow-x-auto pb-1" : "flex flex-col gap-2"} aria-label="Field types">
      {FIELD_TYPE_ORDER.map((type) => (
        <PaletteItem key={type} type={type} compact={compact} onAdd={onAdd} />
      ))}
    </div>
  );
}

FieldPalette.displayName = "FieldPalette";
