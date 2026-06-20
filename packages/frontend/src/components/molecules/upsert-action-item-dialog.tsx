import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { FormDrawer } from "./form-drawer";
import type { ActionPriority, ActionStatus, RecurrenceUnit } from "@/lib/project-types";

export interface UpsertActionItemValues {
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  assigneeId: string | null;
  dueDate: string | null;
  recurrenceUnit: RecurrenceUnit | null;
  recurrenceInterval: number | null;
  recurrenceUntil: string | null;
}

export interface AssigneeOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertActionItemValues>;
  assigneeOptions?: AssigneeOption[];
  onSubmit: (values: UpsertActionItemValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS: { value: ActionStatus; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "InProgress", label: "In progress" },
  { value: "Blocked", label: "Blocked" },
  { value: "Resolved", label: "Resolved" },
];

const PRIORITY: ActionPriority[] = ["Low", "Medium", "High", "Urgent"];

const REPEAT: { value: "" | RecurrenceUnit; label: string }[] = [
  { value: "", label: "Does not repeat" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const UNIT_NOUN: Record<RecurrenceUnit, string> = { day: "day", week: "week", month: "month" };

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertActionItemDialog({
  open,
  onOpenChange,
  mode,
  initial,
  assigneeOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [status, setStatus] = useState<ActionStatus>("Open");
  const [priority, setPriority] = useState<ActionPriority>("Medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState<"" | RecurrenceUnit>("");
  const [recurEvery, setRecurEvery] = useState("1");
  const [repeatUntil, setRepeatUntil] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setDescriptionHtml(initial?.descriptionHtml ?? "");
      setStatus(initial?.status ?? "Open");
      setPriority(initial?.priority ?? "Medium");
      setAssigneeId(initial?.assigneeId ?? "");
      setDueDate(initial?.dueDate ?? "");
      setRepeat(initial?.recurrenceUnit ?? "");
      setRecurEvery(String(initial?.recurrenceInterval ?? 1));
      setRepeatUntil(initial?.recurrenceUntil ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!title.trim()) return;
    const unit = repeat === "" ? null : repeat;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      descriptionHtml: descriptionHtml.trim() ? descriptionHtml : null,
      status,
      priority,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      recurrenceUnit: unit,
      recurrenceInterval: unit ? Math.max(1, Number(recurEvery) || 1) : null,
      recurrenceUntil: unit ? repeatUntil || null : null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New action item" : "Edit action item"}
      description="Track something that needs doing or resolving on this project."
      submitLabel={mode === "create" ? "Create" : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-title">Title</Label>
        <input
          id="ai-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Resolve boundary dispute with neighbour"
          className={field}
        />
      </div>

      <RichTextField
        label="Details"
        value={descriptionHtml}
        onChange={setDescriptionHtml}
        onChangeText={setDescription}
        placeholder="Add any context (optional). Add photos with the image button."
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-status">Status</Label>
          <select id="ai-status" value={status} onChange={(e) => setStatus(e.target.value as ActionStatus)} className={field}>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-priority">Priority</Label>
          <select id="ai-priority" value={priority} onChange={(e) => setPriority(e.target.value as ActionPriority)} className={field}>
            {PRIORITY.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-due">Due date</Label>
        <input id="ai-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-assignee">Assignee</Label>
        <select
          id="ai-assignee"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className={field}
        >
          <option value="">Unassigned</option>
          {assigneeOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-repeat">Repeat</Label>
        <select
          id="ai-repeat"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as "" | RecurrenceUnit)}
          className={field}
        >
          {REPEAT.map((r) => (
            <option key={r.value || "none"} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {repeat !== "" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-interval">Every</Label>
            <div className="flex items-center gap-2">
              <input
                id="ai-interval"
                type="number"
                min={1}
                max={365}
                value={recurEvery}
                onChange={(e) => setRecurEvery(e.target.value)}
                className={`${field} w-20`}
              />
              <span className="text-sm text-gray-500">
                {UNIT_NOUN[repeat]}
                {Number(recurEvery) > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-until">Until (optional)</Label>
            <input
              id="ai-until"
              type="date"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
              className={field}
            />
          </div>
        </div>
      )}
    </FormDrawer>
  );
}

UpsertActionItemDialog.displayName = "UpsertActionItemDialog";

export { UpsertActionItemDialog };
