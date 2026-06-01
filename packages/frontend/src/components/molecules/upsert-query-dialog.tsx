import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { QueryStatus } from "@/lib/project-mock-data";

export interface UpsertQueryValues {
  subject: string;
  question: string;
  status: QueryStatus;
  dueDate: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertQueryValues>;
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
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<QueryStatus>("Open");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setSubject(initial?.subject ?? "");
      setQuestion(initial?.question ?? "");
      setStatus(initial?.status ?? "Open");
      setDueDate(initial?.dueDate ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!subject.trim() || !question.trim()) return;
    onSubmit({
      subject: subject.trim(),
      question: question.trim(),
      status,
      dueDate: dueDate || null,
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q-question">Question</Label>
        <textarea
          id="q-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="Describe what you need clarified"
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

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
    </FormDrawer>
  );
}

UpsertQueryDialog.displayName = "UpsertQueryDialog";

export { UpsertQueryDialog };
