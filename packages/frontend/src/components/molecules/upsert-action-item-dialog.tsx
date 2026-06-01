import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "./form-dialog";
import type { ActionPriority, ActionStatus } from "@/lib/project-mock-data";

export interface UpsertActionItemValues {
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  dueDate: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertActionItemValues>;
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

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertActionItemDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ActionStatus>("Open");
  const [priority, setPriority] = useState<ActionPriority>("Medium");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setStatus(initial?.status ?? "Open");
      setPriority(initial?.priority ?? "Medium");
      setDueDate(initial?.dueDate ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      dueDate: dueDate || null,
    });
  }

  return (
    <FormDialog
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-desc">Details</Label>
        <textarea
          id="ai-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Add any context (optional)"
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

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
    </FormDialog>
  );
}

UpsertActionItemDialog.displayName = "UpsertActionItemDialog";

export { UpsertActionItemDialog };
