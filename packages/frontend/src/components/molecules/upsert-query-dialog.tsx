import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { FormDrawer } from "./form-drawer";
import type { QueryStatus } from "@/lib/project-types";

export interface UpsertQueryValues {
  subject: string;
  question: string;
  questionHtml: string | null;
  status: QueryStatus;
  dueDate: string | null;
  assigneeId: string | null;
}

// Seeds the editor for queries raised before it existed: without this they open
// blank and saving erases the question.
function htmlFromPlainText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped ? `<p>${escaped.replace(/\n/g, "<br>")}</p>` : "";
}

export interface AssigneeOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  mode: "create" | "edit";
  initial?: Partial<UpsertQueryValues>;
  assigneeOptions?: AssigneeOption[];
  onSubmit: (values: UpsertQueryValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS: { value: QueryStatus; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "Answered", label: "Answered" },
  { value: "Closed", label: "Closed" },
];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertQueryDialog({
  open,
  onOpenChange,
  projectId,
  mode,
  initial,
  assigneeOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [questionHtml, setQuestionHtml] = useState("");
  const [status, setStatus] = useState<QueryStatus>("Open");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  useEffect(() => {
    if (open) {
      setSubject(initial?.subject ?? "");
      setQuestion(initial?.question ?? "");
      setQuestionHtml(initial?.questionHtml ?? htmlFromPlainText(initial?.question ?? ""));
      setStatus(initial?.status ?? "Open");
      setDueDate(initial?.dueDate ?? "");
      setAssigneeId(initial?.assigneeId ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!subject.trim() || !question.trim()) return;
    onSubmit({
      subject: subject.trim(),
      question: question.trim(),
      questionHtml: questionHtml || null,
      status,
      dueDate: dueDate || null,
      assigneeId: assigneeId || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Raise a query" : "Edit query"}
      description="Ask a site question or request a clarification from the team."
      submitLabel={mode === "create" ? "Raise query" : "Save changes"}
      submitDisabled={!subject.trim() || !question.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q-subject">Subject</Label>
        <input
          id="q-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Which tile finish for the living room?"
          className={field}
        />
      </div>

      <RichTextField
        label="Question"
        value={questionHtml}
        onChange={setQuestionHtml}
        onChangeText={setQuestion}
        projectId={projectId}
        placeholder="Describe what you need clarified"
      />

      <div className="grid grid-cols-2 gap-3">
        {mode === "edit" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-status">Status</Label>
            <select id="q-status" value={status} onChange={(e) => setStatus(e.target.value as QueryStatus)} className={field}>
              {STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-due">Needed by</Label>
          <input id="q-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q-assignee">Assignee</Label>
        <select id="q-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={field}>
          <option value="">Unassigned</option>
          {assigneeOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </FormDrawer>
  );
}

UpsertQueryDialog.displayName = "UpsertQueryDialog";

export { UpsertQueryDialog };
