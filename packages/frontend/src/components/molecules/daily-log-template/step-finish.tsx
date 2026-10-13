import { CheckCircle2 } from "lucide-react";
import { Switcher } from "@/components/atoms/switcher";
import type { DraftField } from "./field-types";

interface StepFinishProps {
  name: string;
  drafts: DraftField[];
  isDefault: boolean;
  onDefault: (value: boolean) => void;
  /** Only when creating: an existing form's reach is fixed. */
  share?: { value: boolean; onChange: (value: boolean) => void };
  usageCount: number;
}

function Toggle({ title, body, value, onChange }: { title: string; body: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white p-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{body}</p>
      </div>
      <Switcher value={value ? "yes" : "no"} onChange={(next) => onChange(next === "yes")} />
    </div>
  );
}

/** Step 4: who gets the form, then a last look before saving. */
export function StepFinish({ name, drafts, isDefault, onDefault, share, usageCount }: StepFinishProps) {
  const questions = drafts.filter((d) => d.type !== "section");
  const required = questions.filter((d) => d.required).length;
  const sections = drafts.length - questions.length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex items-start gap-3 rounded-xl bg-white p-5 ring-1 ring-line">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary-500" aria-hidden />
        <div>
          <p className="text-base font-semibold text-gray-900">{name || "Untitled form"}</p>
          <p className="mt-1 text-sm text-gray-500">
            {questions.length} question{questions.length === 1 ? "" : "s"}, {required} required
            {sections ? `, in ${sections} section${sections === 1 ? "" : "s"}` : ""}.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {share ? (
          <Toggle
            title="Use on every project in the workspace"
            body="Turn off to keep this form to this project only."
            value={share.value}
            onChange={share.onChange}
          />
        ) : null}
        <Toggle title="Make it the default form" body="New logs, and voice notes from site, fill this form first." value={isDefault} onChange={onDefault} />
      </div>
      {usageCount > 0 ? (
        <p className="rounded-lg bg-surface-info px-3 py-2 text-xs text-primary-700">
          {usageCount} log{usageCount === 1 ? " was" : "s were"} filled with this form. They keep the questions they were filled against; changes apply to new logs only.
        </p>
      ) : null}
    </div>
  );
}

StepFinish.displayName = "StepFinish";
