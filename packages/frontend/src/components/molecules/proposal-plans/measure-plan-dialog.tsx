import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { RadioCard } from "@/components/atoms/radio-card";
import type { TakeoffKind, TakeoffMode, TakeoffScope, TakeoffScopeKind } from "@/api/precon";
import {
  DEFAULT_MEASURE_SCOPES,
  FINISHES_ELEMENTS,
  MEASURABLE_PLAN,
  PDF_PLAN,
  PICTURE_PLAN,
  SCOPES_FOR_PROFILE,
  TAKEOFF_SCOPE_META,
  TAKEOFF_SECTIONS,
} from "@/lib/precon-meta";
import { cn } from "@/lib/utils";

export interface MeasurablePlan {
  id: string;
  fileName: string;
}

export interface ExistingTakeoff {
  title: string;
  revision: number;
  scope: TakeoffScope;
  takeoffKind?: TakeoffKind;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: MeasurablePlan[];
  submitting: boolean;
  error: string | null;
  onConfirm: (scope: TakeoffScope, mode: TakeoffMode) => void;
  // decides which scopes are offered; a labour-only job adds the materials schedule
  jobProfile?: string | null;
  /** Current take-offs already on the chosen drawings, so re-measuring is explained. */
  existing?: ExistingTakeoff[];
  /** Who measures when the dialog opens; the person can switch inside it. */
  initialMode?: TakeoffMode;
  /** WS-M3B: re-measuring on a newer revision starts from the scope of the take-off it replaces. */
  initialScope?: TakeoffScope;
}

const MODE_OPTIONS: { value: TakeoffMode; label: string; hint: string }[] = [
  { value: "ai", label: "Panda AI", hint: "Reads the drawing and drafts every line for review." },
  { value: "manual", label: "By hand", hint: "Opens the sheets for you to draw each line." },
];

const SUBMIT_LABEL: Record<TakeoffMode, string> = { ai: "Start measuring", manual: "Open the sheets" };

function ModePicker({ value, onChange }: { value: TakeoffMode; onChange: (mode: TakeoffMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Who measures">
      {MODE_OPTIONS.map((option) => (
        <RadioCard
          key={option.value}
          title={option.label}
          description={option.hint}
          selected={value === option.value}
          onClick={() => onChange(option.value)}
          className="p-3"
        />
      ))}
    </div>
  );
}
ModePicker.displayName = "ModePicker";

function SectionChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        "outline-none focus-visible:shadow-focus",
        selected
          ? "border-primary-500 bg-primary-50 text-primary-700"
          : "border-line bg-white text-gray-600 hover:border-line-hover",
      )}
    >
      {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}
SectionChip.displayName = "SectionChip";

function SectionPicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const toggle = (element: string) =>
    onChange(selected.includes(element) ? selected.filter((e) => e !== element) : [...selected, element]);
  return (
    <div className="space-y-3 rounded-lg border border-line p-4">
      {TAKEOFF_SECTIONS.map((section) => (
        <div key={section.group}>
          <p className="mb-1.5 text-xs font-medium uppercase text-ink-muted">{section.group}</p>
          <div className="flex flex-wrap gap-1.5">
            {section.elements.map((element) => (
              <SectionChip
                key={element}
                label={element}
                selected={selected.includes(element)}
                onToggle={() => toggle(element)}
              />
            ))}
          </div>
        </div>
      ))}
      {selected.length === 0 ? <p className="text-xs text-red-600">Pick at least one section.</p> : null}
    </div>
  );
}
SectionPicker.displayName = "SectionPicker";

// Manual and AI take-offs keep separate revision lineages on the same drawing,
// so only a take-off of the same kind is replaced by measuring again.
function replacedBy(existing: ExistingTakeoff[], kind: TakeoffScopeKind, mode: TakeoffMode): ExistingTakeoff[] {
  return existing.filter((e) => e.scope.kind === kind && ((e.takeoffKind ?? "pdf") === "manual") === (mode === "manual"));
}

/**
 * The one dialog behind "Measure": who measures (Panda AI or the person) and
 * what the take-off covers. A picture has no engine behind it, so it can only
 * be measured by hand and the choice is not shown.
 */
export function MeasurePlanDialog({
  open, onOpenChange, plans, submitting, error, onConfirm, jobProfile, existing = [], initialMode = "ai", initialScope,
}: Props) {
  const scopes = (jobProfile && SCOPES_FOR_PROFILE[jobProfile]) || DEFAULT_MEASURE_SCOPES;
  const aiCanRead = plans.some((p) => MEASURABLE_PLAN.test(p.fileName));
  const [pickedMode, setPickedMode] = useState<TakeoffMode>(initialMode);
  const mode: TakeoffMode = aiCanRead ? pickedMode : "manual";
  const [kind, setKind] = useState<TakeoffScopeKind>(initialScope?.kind ?? scopes[0] ?? "full");
  const [elements, setElements] = useState<string[]>(initialScope?.elements.length ? initialScope.elements : FINISHES_ELEMENTS);

  const pdfCount = plans.filter((p) => PDF_PLAN.test(p.fileName)).length;
  const pictureCount = plans.filter((p) => PICTURE_PLAN.test(p.fileName)).length;
  const dwgCount = plans.length - pdfCount - pictureCount;
  const fileLabel = plans.length === 1 ? plans[0]!.fileName : `${plans.length} drawings`;
  const submitDisabled = kind === "sections" && elements.length === 0;
  const replaced = replacedBy(existing, kind, mode);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Measure ${fileLabel}`}
      description="Nothing is final. Every line stays editable, and the take-off only reaches the estimate when you bring it in."
      submitLabel={SUBMIT_LABEL[mode]}
      submitting={submitting}
      submitDisabled={submitDisabled}
      error={error}
      onSubmit={() => onConfirm({ kind, elements: kind === "sections" ? elements : [] }, mode)}
      className="w-[min(560px,calc(100vw-2rem))]"
    >
      {aiCanRead ? <ModePicker value={mode} onChange={setPickedMode} /> : null}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase text-ink-muted">What to measure</p>
        {scopes.map((option) => (
          <RadioCard
            key={option}
            title={TAKEOFF_SCOPE_META[option].label}
            description={TAKEOFF_SCOPE_META[option].description}
            selected={kind === option}
            onClick={() => setKind(option)}
            className="p-4"
          />
        ))}
      </div>
      {kind === "sections" ? <SectionPicker selected={elements} onChange={setElements} /> : null}
      {replaced.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {replaced.length === 1
            ? `${replaced[0]!.title} already has this take-off (Rev ${replaced[0]!.revision}).`
            : `${replaced.length} of these drawings already have this take-off.`}{" "}
          Measuring again makes the next revision and marks the current one superseded. The earlier revision stays readable.
        </p>
      ) : null}
      {dwgCount > 0 && mode === "ai" ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {dwgCount === 1 ? "The DWG drawing is" : `${dwgCount} DWG drawings are`} read whole by the automated take-off. Scope applies to PDF drawings.
        </p>
      ) : null}
      {pictureCount > 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {pictureCount === 1 ? "The picture opens" : `${pictureCount} pictures open`} as a sheet with no scale. Use Set scale (S) on two points
          a known distance apart, then measure.
        </p>
      ) : null}
    </FormDialog>
  );
}
MeasurePlanDialog.displayName = "MeasurePlanDialog";
