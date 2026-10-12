import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { Tabs } from "@/components/molecules/tabs";
import type {
  DailyLogTemplate,
  TemplateField,
  TemplateFieldInput,
  TemplateResponses,
  TemplateScope,
} from "@/api/daily-log-templates";
import { useCreateDailyLogTemplate, useUpdateDailyLogTemplate } from "@/hooks/use-daily-log-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { FIELD_TYPE_META, FIELD_TYPE_ORDER, blankField, draftKey, starterFields, type DraftField } from "./field-types";
import { TemplateFieldEditor } from "./template-field-editor";
import { TemplateFormFields } from "./template-form-fields";

const VIEWS = [
  { id: "build", label: "Build" },
  { id: "preview", label: "Preview" },
] as const;
type View = (typeof VIEWS)[number]["id"];

function toDrafts(fields: TemplateField[]): DraftField[] {
  return fields.map((field) => ({ ...field, key: draftKey() }));
}

function toInput(drafts: DraftField[]): TemplateFieldInput[] {
  return drafts.map(({ key: _key, ...field }) => ({
    ...field,
    label: field.label.trim(),
    options: field.type === "select" ? (field.options ?? []).map((o) => o.trim()).filter(Boolean) : [],
  }));
}

/** What still stops the form from saving, in the words a PM would use. */
function problemWith(name: string, drafts: DraftField[]): string | null {
  if (!name.trim()) return "Give the template a name";
  if (!drafts.some((f) => f.type !== "section")) return "Add at least one question";
  const unlabelled = drafts.findIndex((f) => !f.label.trim());
  if (unlabelled >= 0) return `Field ${unlabelled + 1} needs a label`;
  const emptySelect = drafts.find((f) => f.type === "select" && !(f.options ?? []).some((o) => o.trim()));
  if (emptySelect) return `"${emptySelect.label}" needs at least one option`;
  return null;
}

/** Preview renders draft rows as if saved, keyed by their local key. */
function previewFields(drafts: DraftField[]): TemplateField[] {
  return drafts.map((d) => ({
    id: d.key,
    type: d.type,
    label: d.label,
    helpText: d.helpText ?? null,
    required: Boolean(d.required),
    options: d.options ?? [],
    unit: d.unit ?? null,
  }));
}

interface UpsertDailyLogTemplateDrawerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: DailyLogTemplate | null;
}

/** Create or edit a daily log template: name it, lay out its questions, preview the form. */
export function UpsertDailyLogTemplateDrawer({
  projectId,
  open,
  onOpenChange,
  initial,
}: UpsertDailyLogTemplateDrawerProps) {
  const isEdit = initial !== null;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scope, setScope] = useState<TemplateScope>(initial?.scope ?? "organization");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [drafts, setDrafts] = useState<DraftField[]>(() => (initial ? toDrafts(initial.fields) : starterFields()));
  const [view, setView] = useState<View>("build");
  const [preview, setPreview] = useState<TemplateResponses>({});
  const [dirty, setDirty] = useState(false);

  const create = useCreateDailyLogTemplate(projectId);
  const update = useUpdateDailyLogTemplate(projectId);
  const mutation = isEdit ? update : create;
  const problem = problemWith(name, drafts);

  function edit(next: (current: DraftField[]) => DraftField[]): void {
    setDrafts(next);
    setDirty(true);
  }

  function fieldActions(index: number) {
    return {
      onChange: (patch: Partial<DraftField>) =>
        edit((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f))),
      onMove: (direction: -1 | 1) =>
        edit((current) => {
          const next = [...current];
          const [moved] = next.splice(index, 1);
          next.splice(index + direction, 0, moved!);
          return next;
        }),
      onDuplicate: () =>
        edit((current) => {
          const { id: _id, ...copy } = current[index]!;
          return [...current.slice(0, index + 1), { ...copy, key: draftKey() }, ...current.slice(index + 1)];
        }),
      onRemove: () => edit((current) => current.filter((_, i) => i !== index)),
    };
  }

  function submit(): void {
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      fields: toInput(drafts),
      isDefault,
    };
    const onSuccess = () => {
      toast(isEdit ? "Template saved" : "Template created", "success");
      onOpenChange(false);
    };
    if (initial) update.mutate({ id: initial.id, ...body }, { onSuccess });
    else create.mutate({ ...body, scope }, { onSuccess });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      width="xl"
      title={isEdit ? "Edit daily log template" : "New daily log template"}
      description="The form your team fills in for each day's log."
      submitLabel={isEdit ? "Save changes" : "Create template"}
      submitDisabled={problem !== null}
      submitting={mutation.isPending}
      dirty={dirty}
      error={mutation.error ? getApiErrorMessage(mutation.error, "Could not save the template.") : null}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dlt-name">Template name</Label>
          <input
            id="dlt-name"
            value={name}
            placeholder="e.g. Site diary"
            maxLength={120}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dlt-description">Description (optional)</Label>
          <input
            id="dlt-description"
            value={description}
            placeholder="When the team should use this form"
            maxLength={1000}
            onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
            className={INPUT_CLASS}
          />
        </div>
        {/* A project outside a workspace keeps it on the project; the server decides. */}
        {!isEdit ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Share with the whole workspace</p>
              <p className="text-xs text-gray-400">Choose No to keep it to this project only.</p>
            </div>
            <Switcher
              value={scope === "organization" ? "yes" : "no"}
              onChange={(next) => setScope(next === "yes" ? "organization" : "project")}
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Default form</p>
            <p className="text-xs text-gray-400">New logs open on this template.</p>
          </div>
          <Switcher value={isDefault ? "yes" : "no"} onChange={(next) => { setIsDefault(next === "yes"); setDirty(true); }} />
        </div>
        {isEdit && initial.usageCount > 0 ? (
          <p className="rounded-lg bg-surface-info px-3 py-2 text-xs text-primary-700">
            {initial.usageCount} log{initial.usageCount === 1 ? " was" : "s were"} filled with this template. They keep the
            questions they were filled against — changes apply to new logs only.
          </p>
        ) : null}

        <Tabs items={VIEWS} value={view} onChange={setView} ariaLabel="Builder view" />

        {view === "build" ? (
          <div className="flex flex-col gap-3">
            {drafts.map((field, index) => (
              <TemplateFieldEditor
                key={field.key}
                field={field}
                index={index}
                count={drafts.length}
                actions={fieldActions(index)}
              />
            ))}
            <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-line-hover p-3">
              {FIELD_TYPE_ORDER.map((type) => (
                <Button
                  key={type}
                  variant="secondary"
                  size="sm"
                  title={FIELD_TYPE_META[type].hint}
                  onClick={() => edit((current) => [...current, blankField(type)])}
                >
                  <Plus className="size-3.5" /> {FIELD_TYPE_META[type].label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <TemplateFormFields
            fields={previewFields(drafts)}
            responses={preview}
            onChange={(id, value) => setPreview((current) => ({ ...current, [id]: value }))}
          />
        )}
        {problem ? <p className="text-xs text-gray-400">{problem}</p> : null}
      </div>
    </FormDrawer>
  );
}

UpsertDailyLogTemplateDrawer.displayName = "UpsertDailyLogTemplateDrawer";
