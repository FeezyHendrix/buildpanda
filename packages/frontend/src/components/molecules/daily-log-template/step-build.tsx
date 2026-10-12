import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { MousePointer2 } from "lucide-react";
import type { TemplateFieldType } from "@/api/daily-log-templates";
import { FieldPalette } from "./field-palette";
import { FieldProperties } from "./field-properties";
import { blankField, draftKey, FIELD_TYPE_META, type DraftField } from "./field-types";
import { CANVAS_END, FormCanvas } from "./form-canvas";

type Active = { kind: "new"; type: TemplateFieldType } | { kind: "field"; key: string } | null;

// A field from the palette lands only where the pointer actually is; a field
// already on the form snaps to the nearest slot, which suits keyboard moves.
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (String(args.active.id).startsWith("palette:")) return within;
  return within.length ? within : closestCenter(args);
};

interface StepBuildProps {
  drafts: DraftField[];
  onChange: (next: (current: DraftField[]) => DraftField[]) => void;
}

/** Step 2: lay out the questions. Drag in, drag to reorder, tap to edit. */
export function StepBuild({ drafts, onChange }: StepBuildProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [active, setActive] = useState<Active>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const selected = drafts.find((d) => d.key === selectedKey) ?? null;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function insert(type: TemplateFieldType, at: number) {
    const field = blankField(type);
    onChange((current) => [...current.slice(0, at), field, ...current.slice(at)]);
    setSelectedKey(field.key);
  }

  /** A click adds below the selected question, or at the end. */
  function add(type: TemplateFieldType) {
    const index = drafts.findIndex((d) => d.key === selectedKey);
    insert(type, index >= 0 ? index + 1 : drafts.length);
  }

  function patch(key: string, change: Partial<DraftField>) {
    onChange((current) => current.map((f) => (f.key === key ? { ...f, ...change } : f)));
  }

  const actions = {
    onSelect: (key: string) => setSelectedKey((current) => (current === key ? null : key)),
    onDuplicate: (key: string) => {
      const index = drafts.findIndex((d) => d.key === key);
      const source = drafts[index];
      if (!source) return;
      const { id: _id, ...rest } = source;
      const copy = { ...rest, key: draftKey(), label: rest.label ? `${rest.label} (copy)` : "" };
      onChange((current) => [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]);
      setSelectedKey(copy.key);
    },
    onMove: (key: string, by: -1 | 1) => {
      onChange((current) => {
        const from = current.findIndex((d) => d.key === key);
        const to = from + by;
        return from < 0 || to < 0 || to >= current.length ? current : arrayMove(current, from, to);
      });
    },
    onRemove: (key: string) => {
      onChange((current) => current.filter((f) => f.key !== key));
      if (selectedKey === key) setSelectedKey(null);
    },
  };

  function onDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type as TemplateFieldType | undefined;
    setActive(type ? { kind: "new", type } : { kind: "field", key: String(event.active.id) });
  }

  function onDragOver(event: DragOverEvent) {
    if (active?.kind !== "new") return;
    setDropTarget(event.over ? String(event.over.id) : null);
  }

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null;
    if (active?.kind === "new" && overId) {
      const index = drafts.findIndex((d) => d.key === overId);
      insert(active.type, index >= 0 ? index : drafts.length);
    } else if (active?.kind === "field" && overId && overId !== active.key) {
      onChange((current) => {
        const from = current.findIndex((d) => d.key === active.key);
        const to = overId === CANVAS_END ? current.length - 1 : current.findIndex((d) => d.key === overId);
        return from < 0 || to < 0 ? current : arrayMove(current, from, to);
      });
    }
    setActive(null);
    setDropTarget(null);
  }

  // Only a new field needs a floating copy; a field on the form moves in place.
  const overlayType = active?.kind === "new" ? active.type : null;

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActive(null); setDropTarget(null); }}>
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-white p-5 lg:block">
          <h3 className="text-sm font-semibold text-gray-900">Add a field</h3>
          <p className="mb-4 mt-1 text-xs text-gray-500">Drag one onto the form, or click to add it.</p>
          <FieldPalette onAdd={add} />
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-surface-alt px-4 py-5 sm:px-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <div className="lg:hidden">
              <p className="mb-2 text-xs font-medium text-gray-500">Tap to add a field</p>
              <FieldPalette compact onAdd={add} />
            </div>
            <p className="flex items-center gap-2 rounded-lg bg-surface-info px-3 py-2 text-xs text-primary-700">
              <MousePointer2 className="size-3.5 shrink-0" aria-hidden />
              Drag the handle to reorder. Click a question to change its wording, options or whether it&apos;s required.
            </p>
            <FormCanvas
              drafts={drafts}
              selectedKey={selectedKey}
              actions={actions}
              dropTarget={dropTarget}
              renderInline={(field) => (
                <div className="lg:hidden">
                  <FieldProperties field={field} onChange={(change) => patch(field.key, change)} />
                </div>
              )}
            />
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line bg-white p-5 lg:block">
          {selected ? (
            <>
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Edit {FIELD_TYPE_META[selected.type].label.toLowerCase()}</h3>
              <FieldProperties key={selected.key} field={selected} onChange={(change) => patch(selected.key, change)} />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MousePointer2 className="size-6 text-gray-300" aria-hidden />
              <p className="text-sm font-medium text-gray-700">Select a question</p>
              <p className="text-xs text-gray-400">Its settings show up here.</p>
            </div>
          )}
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {overlayType ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-lg">
            {(() => { const Icon = FIELD_TYPE_META[overlayType].icon; return <Icon className="size-4 text-primary-500" aria-hidden />; })()}
            {FIELD_TYPE_META[overlayType].label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

StepBuild.displayName = "StepBuild";
