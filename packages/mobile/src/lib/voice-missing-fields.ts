import { fieldError, isExtendedAction, isVoiceRichText, legacyReviewFields, readVoicePath, richTextFromHtml, spokenRichText, reviewFields, validateExtendedAction, type ExtendedAction, type PickedVoiceFile, type VoiceRichText } from '@buildpanda/voice-actions';
import type { MissingField, ProposedAction } from '@/api/voice-report-types';

export type ReviewValue = string | boolean | PickedVoiceFile | VoiceRichText;
export type ReviewValues = Record<string, ReviewValue>;
export type MissingFieldValues = Record<number, ReviewValues>;

export function actionFields(action: ProposedAction): MissingField[] {
  if (isExtendedAction(action.kind)) return reviewFields(action as ExtendedAction, action.reviewOptions ?? {});
  const fields = action.reviewFields ?? legacyReviewFields(action);
  return [...new Map([...fields, ...action.missing].map((field) => [field.name, field])).values()];
}
export function reviewValues(action: ProposedAction, answers: ReviewValues = {}): ReviewValues {
  const initial: ReviewValues = {};
  for (const field of actionFields(action)) {
    const value = readVoicePath(action.payload, field.name);
    if (field.type === 'rich_text' && !isExtendedAction(action.kind)) {
      const html = field.htmlField ? readVoicePath(action.payload, field.htmlField) : undefined;
      initial[field.name] = typeof html === 'string' ? richTextFromHtml(html) : spokenRichText(typeof value === 'string' ? value : '');
    } else if (value !== null && value !== undefined) initial[field.name] = typeof value === 'number' ? String(value) : value as ReviewValue;
  }
  return { ...initial, ...answers };
}
export function isFieldComplete(field: MissingField, value: ReviewValue | undefined): boolean {
  return reviewFieldError(field, value) === undefined;
}
export function reviewFieldError(field: MissingField, value: ReviewValue | undefined): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : value;
  const parsed = field.type === 'number' && raw !== '' && typeof raw === 'string' ? Number(raw) : raw;
  return fieldError({ ...field, required: field.required ?? true,
    choices: field.type === 'select' ? field.options?.map((row) => row.value) ?? [] : undefined }, parsed);
}
export function outstandingFields(action: ProposedAction, values: ReviewValues | undefined): MissingField[] {
  const answers = reviewValues(action, values);
  return actionFields(action).filter((field) => !isFieldComplete(field, answers[field.name]));
}
export function reviewErrors(action: ProposedAction, values?: ReviewValues): string[] {
  const answers = reviewValues(action, values);
  const errors = actionFields(action).flatMap((field) => {
    const error = reviewFieldError(field, answers[field.name]);
    return error ? [`${field.label}: ${error}`] : [];
  });
  if (isExtendedAction(action.kind)) return [...new Set([...errors, ...validateExtendedAction(mergeMissingValues(action, values) as ExtendedAction, action.reviewOptions ?? {})])];
  const start = answers.startDate ?? answers['patch.startDate'];
  const end = answers.endDate ?? answers['patch.endDate'];
  if (typeof start === 'string' && typeof end === 'string' && end < start) errors.push('End date must be on or after the start date.');
  return errors;
}
export function outstandingCount(actions: readonly ProposedAction[], included: ReadonlySet<number>, values: MissingFieldValues): number {
  return actions.reduce((total, action, index) => total + (included.has(index) ? reviewErrors(action, values[index]).length : 0), 0);
}
export function mergeMissingValues(action: ProposedAction, values: ReviewValues | undefined): ProposedAction {
  const payload: Record<string, unknown> = { ...action.payload };
  const write = (path: string, value: unknown) => {
    if (path.startsWith('response:')) {
      payload.responses = { ...payload.responses as object, [path.slice(9)]: value };
      return;
    }
    const [parent, child] = path.split('.');
    if (child) payload[parent!] = { ...payload[parent!] as object, [child]: value };
    else payload[path] = value;
  };
  const answers = reviewValues(action, values);
  for (const field of actionFields(action)) {
    const value = answers[field.name];
    if (value === undefined) continue;
    if (field.type === 'rich_text' && !isExtendedAction(action.kind) && isVoiceRichText(value)) {
      write(field.name, value.text);
      if (field.htmlField) write(field.htmlField, value.html);
      continue;
    }
    const raw = typeof value === 'string' ? value.trim() : value;
    write(field.name, raw === '' ? null : field.type === 'number' && typeof raw === 'string' ? Number(raw) : raw);
  }
  if (action.kind === 'log_activity') {
    const activity = actionFields(action).find((field) => field.name === 'activityId')?.options?.find((row) => row.value === payload.activityId);
    if (activity) payload.activityName = activity.label;
  }
  return { ...action, payload } as ProposedAction;
}
