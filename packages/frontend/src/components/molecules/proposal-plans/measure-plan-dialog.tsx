import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { RadioCard } from "@/components/atoms/radio-card";
import type { TakeoffKind, TakeoffMode, TakeoffScope, TakeoffScopeKind } from "@/api/precon";
import {
  DEFAULT_MEASURE_SCOPES,
  FINISHES_ELEMENTS,
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
  onConfirm: (scope: TakeoffScope) => void;
  // decides which scopes are offered; a labour-only job adds the materials schedule
  jobProfile?: string | null;
  /** Current take-offs already on the chosen drawings, so re-measuring is explained. */
  existing?: ExistingTakeoff[];
  /** Who measures: Panda AI (default) or the person, drawing on the sheets. */
  mode?: TakeoffMode;
  /** WS-M3B: re-measuring on a newer revision starts from the scope of the take-off it replaces. */
  initialScope?: TakeoffScope;
}

// The same scope picker serves both; only the words change with who measures.
const DIALOG_COPY: Record<
  TakeoffMode,
  { title: string; submitLabel: string; description: (files: string) => string; dwgNote: string }
> = {
  ai: {
    title: "Measure with Panda AI",
    submitLabel: "Start measuring",
    description: (files) =>
      `What should Panda AI produce from ${files}? Nothing is final — every line goes to review before it touches the proposal.`,
    dwgNote: "read by the automated take-off into a take-off you review like any other. Scope applies to PDF drawings.",
  },
  manual: {
    title: "Measure by hand",
    submitLabel: "Open the sheets",
    description: (files) =>
      `You draw, BuildPanda keeps the bill. Panda AI can still help by prompt. What is this take-off of ${files} for?`,
    dwgNote: "opened with its sheet register and bounds; nothing is measured until you draw.",
  },
};

function SectionChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        selected
          ? "border-primary-500 bg-primary-50 text-primary-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
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
    <div className="space-y-3 rounded-xl border border-gray-200 p-4">
      {TAKEOFF_SECTIONS.map((section) => (
        <div key={section.group}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{section.group}</p>
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

export function MeasurePlanDialog({
  open, onOpenChange, plans, submitting, error, onConfirm, jobProfile, existing = [], mode = "ai", initialScope,
}: Props) {
  const scopes = (jobProfile && SCOPES_FOR_PROFILE[jobProfile]) || DEFAULT_MEASURE_SCOPES;
  const [kind, setKind] = useState<TakeoffScopeKind>(initialScope?.kind ?? scopes[0] ?? "full");
  const [elements, setElements] = useState<string[]>(initialScope?.elements.length ? initialScope.elements : FINISHES_ELEMENTS);

  const pdfCount = plans.filter((p) => PDF_PLAN.test(p.fileName)).length;
  const pictureCount = plans.filter((p) => PICTURE_PLAN.test(p.fileName)).length;
  const dwgCount = plans.length - pdfCount - pictureCount;
  const fileLabel = plans.length === 1 ? plans[0]!.fileName : `${plans.length} drawings`;
  const submitDisabled = kind === "sections" && elements.length === 0;
  const replaced = replacedBy(existing, kind, mode);
  const copy = DIALOG_COPY[mode];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description(fileLabel)}
      submitLabel={copy.submitLabel}
      submitting={submitting}
      submitDisabled={submitDisabled}
      error={error}
      onSubmit={() => onConfirm({ kind, elements: kind === "sections" ? elements : [] })}
      className="w-[min(560px,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-2">
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
          Measuring again makes the next revision and marks the current one superseded. Verified lines are not carried
          over; the earlier revision stays readable under the new one.
        </p>
      ) : null}
      {dwgCount > 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {dwgCount === 1 ? "The DWG drawing is" : `${dwgCount} DWG drawings are`} {copy.dwgNote}
        </p>
      ) : null}
      {pictureCount > 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {pictureCount === 1 ? "The picture opens" : `${pictureCount} pictures open`} as a sheet with no scale. Use Set scale (S) on two points
          a known distance apart, then measure. Panda AI does not read pictures.
        </p>
      ) : null}
    </FormDialog>
  );
}
MeasurePlanDialog.displayName = "MeasurePlanDialog";
