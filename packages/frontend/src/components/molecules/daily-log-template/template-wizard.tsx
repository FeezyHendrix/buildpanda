import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import type { DailyLogTemplate, TemplateField, TemplateFieldInput } from "@/api/daily-log-templates";
import { useFormExit } from "@/hooks/use-form-exit";
import { useCreateDailyLogTemplate, useUpdateDailyLogTemplate } from "@/hooks/use-daily-log-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { draftKey, quickCheckFields, starterFields, type DraftField } from "./field-types";
import { StepBuild } from "./step-build";
import { StepFinish } from "./step-finish";
import { StepStart, type StartingPoint } from "./step-start";
import { StepTry } from "./step-try";

const STEPS = ["Start", "Questions", "Try it", "Finish"] as const;

const FIELDS_FOR: Record<StartingPoint, () => DraftField[]> = { diary: starterFields, quick: quickCheckFields, blank: () => [] };

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

/** What still stops the questions from being saved, in plain words. */
function questionsProblem(drafts: DraftField[]): string | null {
  if (!drafts.some((f) => f.type !== "section")) return "Add at least one question";
  const unlabelled = drafts.findIndex((f) => !f.label.trim());
  if (unlabelled >= 0) return `Field ${unlabelled + 1} needs wording`;
  const emptySelect = drafts.find((f) => f.type === "select" && !(f.options ?? []).some((o) => o.trim()));
  if (emptySelect) return `"${emptySelect.label}" needs at least one option`;
  return null;
}

interface TemplateWizardProps {
  projectId: string;
  initial: DailyLogTemplate | null;
  onClose: () => void;
}

/**
 * Creating or editing a daily log form, one step at a time, full screen: name
 * it, lay out its questions by drag and drop, try it as the crew will, then
 * decide who gets it.
 */
export function TemplateWizard({ projectId, initial, onClose }: TemplateWizardProps) {
  const isEdit = initial !== null;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [start, setStart] = useState<StartingPoint>("diary");
  const [drafts, setDrafts] = useState<DraftField[]>(() => (initial ? toDrafts(initial.fields) : starterFields()));
  const [questionsEdited, setQuestionsEdited] = useState(false);
  const [shared, setShared] = useState(initial ? initial.scope === "organization" : true);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [dirty, setDirty] = useState(false);

  const create = useCreateDailyLogTemplate(projectId);
  const update = useUpdateDailyLogTemplate(projectId);
  const mutation = isEdit ? update : create;
  const exit = useFormExit(true, mutation.isPending, onClose, { dirty });

  const problems = [name.trim() ? null : "Give the form a name", questionsProblem(drafts), null, null];
  const problem = problems[step];
  const reachable = (target: number) => target <= step || problems.slice(0, target).every((p) => p === null);

  function touch<T>(set: (value: T) => void) {
    return (value: T) => { set(value); setDirty(true); };
  }

  function chooseStart(point: StartingPoint) {
    setStart(point);
    setDirty(true);
    // swap the questions only while they are still untouched
    if (!questionsEdited) setDrafts(FIELDS_FOR[point]());
  }

  function save() {
    const body = { name: name.trim(), description: description.trim() || null, fields: toInput(drafts), isDefault };
    const onSuccess = () => {
      toast(isEdit ? "Form saved" : "Form created", "success");
      onClose();
    };
    if (initial) update.mutate({ id: initial.id, ...body }, { onSuccess });
    else create.mutate({ ...body, scope: shared ? "organization" : "project" }, { onSuccess });
  }

  const last = step === STEPS.length - 1;

  return (
    <>
      <Dialog.Root open onOpenChange={(next) => { if (!next) exit.close(); }}>
        <Dialog.Portal>
          <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-surface-alt outline-none">
            <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
              <Dialog.Title className="min-w-0 flex-1 truncate text-base font-semibold text-gray-900">
                {isEdit ? `Edit ${initial.name}` : "New daily log form"}
              </Dialog.Title>
              <button type="button" onClick={exit.close} aria-label="Close" className="inline-flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="size-5" />
              </button>
            </header>

            <nav aria-label="Steps" className="border-b border-line bg-white px-4 py-3 sm:px-6">
              <ol className="mx-auto flex max-w-3xl items-center gap-2">
                {STEPS.map((label, index) => {
                  const done = index < step;
                  const current = index === step;
                  return (
                    <li key={label} className="flex flex-1 items-center gap-2">
                      <button
                        type="button"
                        disabled={!reachable(index)}
                        onClick={() => setStep(index)}
                        aria-current={current ? "step" : undefined}
                        className="flex items-center gap-2 rounded-lg px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed"
                      >
                        <span className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          current ? "bg-primary-500 text-white" : done ? "bg-primary-50 text-primary-600" : "bg-gray-100 text-gray-400",
                        )}>
                          {done ? <Check className="size-4" /> : index + 1}
                        </span>
                        <span className={cn("hidden text-sm sm:block", current ? "font-semibold text-gray-900" : "text-gray-500")}>{label}</span>
                      </button>
                      {index < STEPS.length - 1 ? <span className={cn("h-px flex-1", done ? "bg-primary-300" : "bg-line")} aria-hidden /> : null}
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className={cn("min-h-0 flex-1", step === 1 ? "overflow-hidden" : "overflow-y-auto")}>
              {step === 0 ? (
                <StepStart
                  name={name}
                  description={description}
                  onName={touch(setName)}
                  onDescription={touch(setDescription)}
                  start={isEdit ? undefined : { value: start, onChange: chooseStart }}
                />
              ) : step === 1 ? (
                <StepBuild drafts={drafts} onChange={(next) => { setDrafts(next); setQuestionsEdited(true); setDirty(true); }} />
              ) : step === 2 ? (
                <StepTry name={name} drafts={drafts} />
              ) : (
                <StepFinish
                  name={name}
                  drafts={drafts}
                  isDefault={isDefault}
                  onDefault={touch(setIsDefault)}
                  share={isEdit ? undefined : { value: shared, onChange: touch(setShared) }}
                  usageCount={initial?.usageCount ?? 0}
                />
              )}
            </div>

            {mutation.error ? (
              <p className="border-t border-red-100 bg-red-50 px-6 py-2 text-sm text-red-600">{getApiErrorMessage(mutation.error, "Could not save the form.")}</p>
            ) : null}
            <footer className="flex items-center gap-3 border-t border-line bg-white px-4 py-3 sm:px-6">
              <Button variant="secondary" size="md" onClick={() => (step === 0 ? exit.close() : setStep(step - 1))}>
                {step === 0 ? "Cancel" : <><ArrowLeft className="size-4" /> Back</>}
              </Button>
              <p className="min-w-0 flex-1 truncate text-right text-xs text-gray-500" aria-live="polite">{problem ?? ""}</p>
              {last ? (
                <Button variant="primary" size="md" loading={mutation.isPending} disabled={problems.some((p) => p !== null)} onClick={save}>
                  {isEdit ? "Save changes" : "Create form"}
                </Button>
              ) : (
                <Button variant="primary" size="md" disabled={problem !== null} onClick={() => setStep(step + 1)}>
                  Next <ArrowRight className="size-4" />
                </Button>
              )}
            </footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmDialog
        open={exit.confirming}
        onOpenChange={(next) => { if (!next) exit.keepEditing(); }}
        title="Discard this form?"
        description="Your changes have not been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={exit.discard}
      />
    </>
  );
}

TemplateWizard.displayName = "TemplateWizard";
