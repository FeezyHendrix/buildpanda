import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";
import type { ActivityDependency, ActivityDependencyType } from "@/lib/project-types";

export interface PredecessorChoice {
  id: string;
  name: string;
}

interface ActivityPredecessorsFieldProps {
  value: ActivityDependency[];
  options: PredecessorChoice[];
  onChange: (next: ActivityDependency[]) => void;
}

const DEPENDENCY_TYPES: { value: ActivityDependencyType; label: string }[] = [
  { value: "FS", label: "Finish to start" },
  { value: "SS", label: "Start to start" },
  { value: "FF", label: "Finish to finish" },
  { value: "SF", label: "Start to finish" },
];

const TYPE_LABEL: Record<ActivityDependencyType, string> = {
  FS: "Finish to start",
  SS: "Start to start",
  FF: "Finish to finish",
  SF: "Start to finish",
};

function lagLabel(lagDays: number): string {
  if (lagDays === 0) return "no lag";
  const unit = Math.abs(lagDays) === 1 ? "day" : "days";
  return lagDays > 0 ? `+${lagDays} ${unit} lag` : `${lagDays} ${unit} lead`;
}

/**
 * Dependencies are what make a delay cascade: without them a slipped activity
 * moves nothing downstream. Kept as a small list-plus-add control rather than a
 * grid, because a site activity rarely has more than two or three predecessors.
 */
function ActivityPredecessorsField({ value, options, onChange }: ActivityPredecessorsFieldProps) {
  const [pendingId, setPendingId] = useState("");
  const [pendingType, setPendingType] = useState<ActivityDependencyType>("FS");
  const [pendingLag, setPendingLag] = useState("0");

  const nameById = new Map(options.map((o) => [o.id, o.name]));
  const taken = new Set(value.map((d) => d.activityId));
  const available = options.filter((o) => !taken.has(o.id));

  function add(): void {
    if (!pendingId) return;
    const lagDays = Math.trunc(Number(pendingLag) || 0);
    onChange([...value, { activityId: pendingId, type: pendingType, lagDays }]);
    setPendingId("");
    setPendingType("FS");
    setPendingLag("0");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="activity-predecessor-pick">Predecessors</Label>

      {value.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line-hair rounded-lg border border-line-hair">
          {value.map((dep) => (
            <li key={dep.activityId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{nameById.get(dep.activityId) ?? dep.activityId}</p>
                <p className="text-xs text-ink-muted">
                  {TYPE_LABEL[dep.type]} · {lagLabel(dep.lagDays)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(value.filter((d) => d.activityId !== dep.activityId))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-muted">
          No predecessors — a delay on this activity will not move anything before it.
        </p>
      )}

      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
        <select
          id="activity-predecessor-pick"
          value={pendingId}
          onChange={(e) => setPendingId(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Add a predecessor…</option>
          {available.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Dependency type"
          value={pendingType}
          onChange={(e) => setPendingType(e.target.value as ActivityDependencyType)}
          className={INPUT_CLASS}
        >
          {DEPENDENCY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.value}
            </option>
          ))}
        </select>
        <input
          aria-label="Lag in days"
          type="number"
          min={-365}
          max={365}
          step={1}
          value={pendingLag}
          onChange={(e) => setPendingLag(e.target.value)}
          className={`${INPUT_CLASS} w-20`}
        />
        <Button type="button" variant="secondary" size="sm" disabled={!pendingId} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

ActivityPredecessorsField.displayName = "ActivityPredecessorsField";

export { ActivityPredecessorsField, type ActivityPredecessorsFieldProps };
