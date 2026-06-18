import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { RfiPriority } from "@/lib/project-types";

export interface UpsertRfiValues {
  subject: string;
  question: string;
  priority: RfiPriority;
  dueDate: string | null;
  costImpact: boolean;
  scheduleImpact: boolean;
  ballInCourtId: string | null;
}

export interface AssigneeOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UpsertRfiValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  assigneeOptions?: AssigneeOption[];
}

const PRIORITIES: { value: RfiPriority; label: string }[] = [
  { value: "Low", label: "Low" },
  { value: "Normal", label: "Normal" },
  { value: "High", label: "High" },
];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

const EMPTY: UpsertRfiValues = {
  subject: "",
  question: "",
  priority: "Normal",
  dueDate: null,
  costImpact: false,
  scheduleImpact: false,
  ballInCourtId: null,
};

export function UpsertRfiDialog({ open, onOpenChange, onSubmit, isSubmitting, error, assigneeOptions = [] }: Props) {
  const [values, setValues] = useState<UpsertRfiValues>(EMPTY);

  useEffect(() => {
    if (open) setValues(EMPTY);
  }, [open]);

  function update<K extends keyof UpsertRfiValues>(key: K, value: UpsertRfiValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const canSubmit = values.subject.trim() !== "" && values.question.trim() !== "";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Raise an RFI"
      description="Request information from the design team or contractor. It gets a number and a ball-in-court owner."
      submitLabel="Create RFI"
      onSubmit={() => onSubmit(values)}
      submitting={isSubmitting}
      submitDisabled={!canSubmit}
      error={error}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfi-subject">Subject</Label>
        <input
          id="rfi-subject"
          className={field}
          value={values.subject}
          maxLength={200}
          onChange={(e) => update("subject", e.target.value)}
          placeholder="e.g. Confirm rebar spec for raft foundation"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfi-question">Question</Label>
        <textarea
          id="rfi-question"
          className={`${field} h-28 resize-none py-2.5`}
          value={values.question}
          maxLength={8000}
          onChange={(e) => update("question", e.target.value)}
          placeholder="Describe what you need clarified, referencing drawings or specs."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rfi-priority">Priority</Label>
          <select
            id="rfi-priority"
            className={field}
            value={values.priority}
            onChange={(e) => update("priority", e.target.value as RfiPriority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rfi-due">Due date</Label>
          <input
            id="rfi-due"
            type="date"
            className={field}
            value={values.dueDate ?? ""}
            onChange={(e) => update("dueDate", e.target.value || null)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfi-bic">Ball in court</Label>
        <select
          id="rfi-bic"
          className={field}
          value={values.ballInCourtId ?? ""}
          onChange={(e) => update("ballInCourtId", e.target.value || null)}
        >
          <option value="">Unassigned (you)</option>
          {assigneeOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={values.costImpact}
            onChange={(e) => update("costImpact", e.target.checked)}
          />
          Has cost impact
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={values.scheduleImpact}
            onChange={(e) => update("scheduleImpact", e.target.checked)}
          />
          Has schedule impact
        </label>
      </div>
    </FormDrawer>
  );
}

UpsertRfiDialog.displayName = "UpsertRfiDialog";
