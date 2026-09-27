import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { ToggleRow } from "@/components/atoms/toggle-row";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { FormDrawer } from "./form-drawer";
import type { Rfi, RfiPriority } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";

export interface UpsertRfiValues {
  subject: string;
  question: string;
  questionHtml: string | null;
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
  projectId: string;
  /** Present in edit mode; the dialog then saves changes instead of creating. */
  initial?: Rfi | null;
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

const field = INPUT_CLASS;

const EMPTY: UpsertRfiValues = {
  subject: "",
  question: "",
  questionHtml: null,
  priority: "Normal",
  dueDate: null,
  costImpact: false,
  scheduleImpact: false,
  ballInCourtId: null,
  ballInCourtName: null,
  ballInCourtEmail: null,
};

function fromRfi(rfi: Rfi): UpsertRfiValues {
  return {
    subject: rfi.subject,
    question: rfi.question,
    questionHtml: rfi.questionHtml,
    priority: rfi.priority,
    dueDate: rfi.dueDate ? rfi.dueDate.slice(0, 10) : null,
    costImpact: rfi.costImpact,
    scheduleImpact: rfi.scheduleImpact,
    ballInCourtId: rfi.ballInCourtId,
    ballInCourtName: rfi.ballInCourtName,
    ballInCourtEmail: rfi.ballInCourtEmail,
  };
}

export function UpsertRfiDialog({ open, onOpenChange, projectId, initial, onSubmit, isSubmitting, error, assigneeOptions = [] }: Props) {
  const isEdit = Boolean(initial);
  const [values, setValues] = useState<UpsertRfiValues>(EMPTY);

  // Reset on every open, so the next RFI never inherits the last one's question
  // (finding F34 — RFI-3 was saved with RFI-2's text).
  useEffect(() => {
    if (open) setValues(initial ? fromRfi(initial) : EMPTY);
  }, [open, initial]);

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
      title={isEdit ? `Edit RFI-${initial!.number}` : "Raise an RFI"}
      description={
        isEdit
          ? "Correct the question, priority, due date or ball-in-court owner. The change is recorded on the RFI's history."
          : "Request information from the design team or contractor. It gets a number and a ball-in-court owner."
      }
      submitLabel={isEdit ? "Save changes" : "Create RFI"}
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

      <RichTextField
        label="Question"
        value={values.questionHtml ?? ""}
        onChange={(html) => update("questionHtml", html)}
        onChangeText={(text) => update("question", text)}
        projectId={projectId}
        placeholder="Describe what you need clarified, referencing drawings or specs."
      />

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
