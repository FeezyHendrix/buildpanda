import { useState } from "react";
import { Smartphone } from "lucide-react";
import type { TemplateField, TemplateResponses } from "@/api/daily-log-templates";
import type { DraftField } from "./field-types";
import { missingRequired, TemplateFormFields } from "./template-form-fields";

/** Draft rows rendered as if saved, keyed by their local key. */
function asFields(drafts: DraftField[]): TemplateField[] {
  return drafts.map((d) => ({
    id: d.key,
    type: d.type,
    label: d.label || (d.type === "section" ? "Untitled section" : "Untitled question"),
    helpText: d.helpText ?? null,
    required: Boolean(d.required),
    options: (d.options ?? []).filter((o) => o.trim()),
    unit: d.unit ?? null,
  }));
}

/** Step 3: fill the form in as the crew will, before anyone else sees it. */
export function StepTry({ name, drafts }: { name: string; drafts: DraftField[] }) {
  const [answers, setAnswers] = useState<TemplateResponses>({});
  const fields = asFields(drafts);
  const missing = missingRequired(fields, answers);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-8">
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Smartphone className="size-4" aria-hidden /> Try it out. This is what your team sees. Nothing you type here is saved.
      </p>
      <div className="w-full max-w-sm rounded-[2rem] border-8 border-gray-900 bg-white shadow-xl">
        <div className="border-b border-line px-5 py-4">
          <p className="text-xs text-gray-400">Daily log</p>
          <p className="text-base font-semibold text-gray-900">{name || "Untitled form"}</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <TemplateFormFields fields={fields} responses={answers} onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))} />
        </div>
        <div className="border-t border-line px-5 py-3 text-xs text-gray-500">
          {missing.length ? `Still required: ${missing.join(", ")}` : "Everything required is answered."}
        </div>
      </div>
    </div>
  );
}

StepTry.displayName = "StepTry";
