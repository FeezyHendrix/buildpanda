import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { useProjectActivities } from "@/hooks/use-activities";

export interface RfiReference {
  type: "action_item" | "activity";
  id: string;
  label: string;
}

export function referenceLabel(reference: RfiReference): string {
  return `${reference.type === "action_item" ? "Action" : "Activity"}: ${reference.label}`;
}

export function ReferenceChips({
  references,
  onRemove,
}: {
  references: readonly RfiReference[];
  onRemove?: (index: number) => void;
}) {
  if (references.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {references.map((reference, index) => (
        <Badge key={`${reference.id}-${index}`} tone="accent" size="sm">
          {referenceLabel(reference)}
          {onRemove ? (
            <button type="button" className="ml-1" aria-label="Remove reference" onClick={() => onRemove(index)}>
              ×
            </button>
          ) : null}
        </Badge>
      ))}
    </div>
  );
}

export function ReferencePicker({
  projectId,
  onPick,
}: {
  projectId: string;
  onPick: (ref: RfiReference) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: activities = [] } = useProjectActivities(projectId);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Reference an item
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-line-hair bg-white p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Reference an item</span>
        <button type="button" className="text-xs text-gray-400" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {activities.length > 0 && (
          <p className="px-1 py-1 text-[10px] uppercase tracking-wide text-gray-400">Activities</p>
        )}
        {activities.map((a) => (
          <button
            key={a.id}
            type="button"
            className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              onPick({ type: "activity", id: a.id, label: a.name });
              setOpen(false);
            }}
          >
            {a.name}
          </button>
        ))}
        {activities.length === 0 && (
          <p className="px-2 py-2 text-sm text-gray-400">Nothing to reference yet.</p>
        )}
      </div>
    </div>
  );
}
