import type { CommentAssignee } from "@/api/participants";
import { Field, OptionRow } from "@/components/atoms";
import { isIsoDate } from "@/lib/dates";

const UNASSIGNED = "unassigned";
const IMPACT_OPTIONS = ["No", "Yes"] as const;

/** Segmented yes/no for a boolean, styled like every other enum field in a form. */
function ImpactRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <OptionRow
      label={label}
      options={IMPACT_OPTIONS}
      value={value ? "Yes" : "No"}
      onChange={(next) => onChange(next === "Yes")}
    />
  );
}

/**
 * Who has to answer. Project members with an account, plus "Unassigned", as
 * chips. A name already on the RFI that is not in the cached member list (set
 * on the web, or the list never fetched) is kept as its own chip so an edit
 * with no signal cannot silently drop the assignment.
 */
function BallInCourtPicker({
  assignees,
  valueId,
  valueName,
  onChange,
}: {
  assignees: readonly CommentAssignee[];
  valueId: string | null;
  valueName: string | null;
  onChange: (id: string | null, name: string | null) => void;
}) {
  const known = assignees.some((person) => person.id === valueId);
  const people: CommentAssignee[] = [
    { id: UNASSIGNED, name: "Unassigned" },
    ...(valueId && !known ? [{ id: valueId, name: valueName ?? "Assigned" }] : []),
    ...assignees,
  ];
  return (
    <OptionRow
      label="Ball in court"
      options={people.map((person) => ({ value: person.id, label: person.name }))}
      value={valueId ?? UNASSIGNED}
      onChange={(id) => {
        const person = people.find((row) => row.id === id);
        onChange(id === UNASSIGNED ? null : id, id === UNASSIGNED ? null : (person?.name ?? null));
      }}
    />
  );
}

interface RfiFormFieldsProps {
  dueDate: string;
  onDueDateChange: (next: string) => void;
  costImpact: boolean;
  onCostImpactChange: (next: boolean) => void;
  scheduleImpact: boolean;
  onScheduleImpactChange: (next: boolean) => void;
  ballInCourtId: string | null;
  ballInCourtName: string | null;
  onBallInCourtChange: (id: string | null, name: string | null) => void;
  assignees: readonly CommentAssignee[];
}

/** True when the typed due date is empty or a real `YYYY-MM-DD` — the only forms the API takes. */
export function isDueDateValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || isIsoDate(trimmed);
}

/** The RFI fields beyond subject, question and priority, shared by the new and edit screens. */
export function RfiFormFields({
  dueDate,
  onDueDateChange,
  costImpact,
  onCostImpactChange,
  scheduleImpact,
  onScheduleImpactChange,
  ballInCourtId,
  ballInCourtName,
  onBallInCourtChange,
  assignees,
}: RfiFormFieldsProps) {
  return (
    <>
      <BallInCourtPicker
        assignees={assignees}
        valueId={ballInCourtId}
        valueName={ballInCourtName}
        onChange={onBallInCourtChange}
      />
      <Field
        label="Due date"
        value={dueDate}
        onChangeText={onDueDateChange}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        error={isDueDateValid(dueDate) ? undefined : "Enter a date as YYYY-MM-DD."}
      />
      <ImpactRow label="Cost impact" value={costImpact} onChange={onCostImpactChange} />
      <ImpactRow label="Schedule impact" value={scheduleImpact} onChange={onScheduleImpactChange} />
    </>
  );
}

RfiFormFields.displayName = "RfiFormFields";
