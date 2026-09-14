import type { MissingField, ProposedAction } from "@/api/voice-report-types";

/** What the reviewer typed, keyed action index → field name. The screen owns it. */
export type MissingFieldValues = Record<number, Record<string, string>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A field counts as supplied once it is present *and* usable by the API. A
 * half-typed date or a non-numeric quantity would otherwise be written onto the
 * record verbatim, which is worse than the reviewer being asked again.
 */
export function isFieldComplete(field: MissingField, value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return false;
  if (field.type === "date") return ISO_DATE.test(trimmed);
  if (field.type === "number") return Number.isFinite(Number(trimmed));
  return true;
}

/** The fields on one action the reviewer still has to answer. */
export function outstandingFields(
  action: ProposedAction,
  values: Record<string, string> | undefined,
): MissingField[] {
  return action.missing.filter((field) => !isFieldComplete(field, values?.[field.name]));
}

/** How many answers are still owed across the actions the reviewer kept. */
export function outstandingCount(
  actions: readonly ProposedAction[],
  includedIndexes: ReadonlySet<number>,
  values: MissingFieldValues,
): number {
  let total = 0;
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (!action || !includedIndexes.has(index)) continue;
    total += outstandingFields(action, values[index]).length;
  }
  return total;
}

/**
 * Folds the reviewer's answers into the drafted payload, coercing by the type
 * the server declared. Nothing is invented here — a field the reviewer left
 * blank stays absent, and the caller refuses to apply the action.
 */
export function mergeMissingValues(
  action: ProposedAction,
  values: Record<string, string> | undefined,
): ProposedAction {
  if (action.missing.length === 0) return action;

  const patch: Record<string, string | number> = {};
  for (const field of action.missing) {
    const raw = values?.[field.name]?.trim();
    if (!raw) continue;
    patch[field.name] = field.type === "number" ? Number(raw) : raw;
  }

  const payload = { ...action.payload, ...patch };
  // `kind` and `payload` are correlated across the union and TypeScript cannot
  // follow that through a spread. The patch only ever carries the field names
  // the server declared for *this* action, so the payload keeps its own shape.
  return { ...action, payload } as ProposedAction;
}
