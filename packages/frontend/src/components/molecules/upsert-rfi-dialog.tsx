import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { ToggleRow } from "@/components/atoms/toggle-row";
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
  ballInCourtName: string | null;
  ballInCourtEmail: string | null;
}

export interface AssigneeOption {
  id: string;
  name: string;
  email: string | null;
  isUser: boolean;
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
  ballInCourtName: null,
  ballInCourtEmail: null,
};

export function UpsertRfiDialog({ open, onOpenChange, onSubmit, isSubmitting, error, assigneeOptions = [] }: Props) {
  const [values, setValues] = useState<UpsertRfiValues>(EMPTY);

  useEffect(() => {
    if (open) setValues(EMPTY);
  }, [open]);

  function update<K extends keyof UpsertRfiValues>(key: K, value: UpsertRfiValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const selectedOptionKey = values.ballInCourtId
    ? `user:${values.ballInCourtId}`
    : values.ballInCourtName
      ? (() => {
          const contact = assigneeOptions.find(
            (a) => !a.isUser && a.name === values.ballInCourtName,
          );
          return contact ? `contact:${contact.id}` : "";
        })()
      : "";

  function selectAssignee(key: string): void {
    if (!key) {
      setValues((prev) => ({ ...prev, ballInCourtId: null, ballInCourtName: null, ballInCourtEmail: null }));
      return;
    }
    const [kind, id] = key.split(":", 2) as ["user" | "contact", string];
    const option = assigneeOptions.find((a) => a.id === id && a.isUser === (kind === "user"));
    if (!option) return;
    setValues((prev) => ({
      ...prev,
      ballInCourtId: option.isUser ? option.id : null,
      ballInCourtName: option.isUser ? null : option.name,
      ballInCourtEmail: option.email,
    }));
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
          value={selectedOptionKey}
          onChange={(e) => selectAssignee(e.target.value)}
        >
          <option value="">Unassigned (you)</option>
          {assigneeOptions.map((a) => (
            <option key={`${a.isUser ? "user" : "contact"}:${a.id}`} value={`${a.isUser ? "user" : "contact"}:${a.id}`}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfi-bic-email">Notify email</Label>
        <input
          id="rfi-bic-email"
          type="email"
          className={field}
          value={values.ballInCourtEmail ?? ""}
          onChange={(e) => update("ballInCourtEmail", e.target.value || null)}
          placeholder="Where the ball-in-court owner is notified"
        />
        <p className="text-xs text-gray-400">
          Pre-filled from the selected person. Edit it to send the notification elsewhere.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <ToggleRow
          title="Has cost impact"
          description="Flag if answering this could change the project cost. Lets you convert the RFI into a change event."
          checked={values.costImpact}
          onChange={(checked) => update("costImpact", checked)}
        />
        <ToggleRow
          title="Has schedule impact"
          description="Flag if answering this could affect the programme. Lets you convert the RFI into a change event."
          checked={values.scheduleImpact}
          onChange={(checked) => update("scheduleImpact", checked)}
        />
      </div>
    </FormDrawer>
  );
}

UpsertRfiDialog.displayName = "UpsertRfiDialog";
