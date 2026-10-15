import { ContentText } from "@/components/molecules/rich-content";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { RichTextField } from "@/components/molecules/rich-text-field";
import {
  TemplateFormFields,
  missingRequired,
} from "@/components/molecules/daily-log-template/template-form-fields";
import type { DailyLogTemplate, TemplateResponses } from "@/api/daily-log-templates";
import { useAddDailyLogEntry } from "@/hooks/use-daily-logs";
import { useDailyLogTemplates } from "@/hooks/use-daily-log-templates";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

const FREE_FORM = "free-form";

/** A project's own default beats the workspace's; with neither, the log is free-form. */
function defaultTemplateId(templates: DailyLogTemplate[]): string {
  const project = templates.find((t) => t.isDefault && t.scope === "project");
  const workspace = templates.find((t) => t.isDefault && t.scope === "organization");
  return (project ?? workspace)?.id ?? FREE_FORM;
}

interface EntryComposerProps {
  projectId: string;
  logDate: string;
  autoFocus: boolean;
}

/**
 * Where a team member adds their log for the day: the project's daily log
 * template when it has one, with free-form notes and photos underneath, or a
 * free-form note on its own.
 */
export function EntryComposer({ projectId, logDate, autoFocus }: EntryComposerProps) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  // null until the author picks one, so the default applies once templates load.
  const [choice, setChoice] = useState<string | null>(null);
  const [responses, setResponses] = useState<TemplateResponses>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const addEntry = useAddDailyLogEntry();
  const { data: templates = [] } = useDailyLogTemplates(projectId);

  // The tiptap editor mounts a tick after the drawer, so watch the wrapper and
  // focus the first field as soon as it exists (no rAF: it never fires in a
  // background tab). The popup's own initial focus is disabled in that mode.
  useEffect(() => {
    if (!autoFocus) return;
    const root = wrapperRef.current;
    if (!root) return;
    const focusFirst = (): boolean => {
      const target = root.querySelector<HTMLElement>('[data-composer-field], [contenteditable="true"]');
      if (!target) return false;
      target.scrollIntoView({ block: "center" });
      target.focus();
      return true;
    };
    if (focusFirst()) return;
    const observer = new MutationObserver(() => {
      if (focusFirst()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [autoFocus, logDate]);

  const selectedId = choice ?? defaultTemplateId(templates);
  const template = templates.find((t) => t.id === selectedId) ?? null;
  const missing = template ? missingRequired(template.fields, responses) : [];
  const hasNotes = text.trim().length > 0;
  const canSubmit = template ? missing.length === 0 : hasNotes;

  function reset(): void {
    setHtml("");
    setText("");
    setResponses({});
    setEditorKey((k) => k + 1);
  }

  function submit(): void {
    const entry = template
      ? { templateId: template.id, responses, bodyHtml: html.trim() ? html : null, bodyText: hasNotes ? text : null }
      : { bodyHtml: html, bodyText: text };
    addEntry.mutate(
      { projectId, logDate, ...entry },
      {
        onSuccess: () => {
          reset();
          toast("Your log was added", "success");
        },
        onError: () => toast("Could not add your log"),
      },
    );
  }

  return (
    <div ref={wrapperRef} className="mt-4 flex flex-col gap-4 border-t border-line-hair pt-4">
      {templates.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-template">Add my log using</Label>
          <select
            id="entry-template"
            data-composer-field
            value={selectedId}
            onChange={(e) => {
              setChoice(e.target.value);
              setResponses({});
            }}
            className={INPUT_CLASS}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={FREE_FORM}>Free-form note</option>
          </select>
          {template?.description ? <p className="text-xs text-gray-400"><ContentText value={template.description} /></p> : null}
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          Want a standard form for your team?{" "}
          <Link to={`/project/${projectId}/settings?tab=daily-log`} className="font-semibold text-primary-500 hover:underline">
            Set up a daily log template
          </Link>
        </p>
      )}

      {template ? (
        <TemplateFormFields
          fields={template.fields}
          responses={responses}
          onChange={(id, value) => setResponses((current) => ({ ...current, [id]: value }))}
        />
      ) : null}

      <RichTextField
        key={`${editorKey}-${template ? "notes" : "free"}`}
        label={template ? "Notes and photos (optional)" : "Add my log"}
        value={html}
        onChange={setHtml}
        onChangeText={setText}
        projectId={projectId}
        placeholder={
          template
            ? "Anything the form doesn't cover."
            : "e.g. Completed the level 3 slab pour, inspected rebar, flagged a delivery delay…"
        }
      />
      {addEntry.error ? (
        <p className="rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">{errorMessage(addEntry.error)}</p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        {template && missing.length > 0 ? (
          <p className="mr-auto text-xs text-gray-400">Still required: {missing.join(", ")}</p>
        ) : null}
        <Button type="button" variant="primary" size="sm" disabled={!canSubmit} loading={addEntry.isPending} onClick={submit}>
          Add entry
        </Button>
      </div>
    </div>
  );
}

EntryComposer.displayName = "EntryComposer";
