import { extendedActions, isExtendedAction, type ExtendedAction } from './catalog.ts';
import type { PickedVoiceFile, VoiceField, VoiceOptions, VoiceReviewField, VoiceValue } from './types.ts';
import { isVoiceRichText, spokenRichText } from './rich-text.ts';

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validPickedFile(value: unknown): value is PickedVoiceFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as PickedVoiceFile;
  return typeof file.uri === 'string' && /^(file|content|blob):/.test(file.uri) && typeof file.fileName === 'string' && !!file.fileName.trim() &&
    typeof file.mimeType === 'string' && Number.isFinite(file.size) && file.size >= 0;
}
export function fieldComplete(field: VoiceField & { options?: readonly { value: string }[] }, value: unknown): boolean {
  if (!['text', 'long_text', 'rich_text', 'boolean', 'number', 'date', 'select', 'file'].includes(field.type)) return false;
  if (value === null || value === undefined || value === '') return !field.required;
  if (field.type === 'file') return validPickedFile(value);
  if (field.type === 'rich_text') return isVoiceRichText(value) && (value.text.length > 0 || !field.required) && value.html.length <= 50000;
  if (field.type === 'boolean') return typeof value === 'boolean';
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= (field.min ?? -Infinity) && value <= (field.max ?? Infinity);
  if (typeof value !== 'string' || !value.trim()) return false;
  if (field.type === 'date') return validDate(value);
  if (field.choices) return field.choices.includes(value);
  if (field.source) return field.options?.some((option) => option.value === value) === true;
  return (field.type === 'text' || field.type === 'long_text') && value.length <= 10000;
}
export function fieldError(field: VoiceReviewField, value: unknown): string | undefined {
  if (fieldComplete(field, value)) return undefined;
  if (field.type === 'select' && !field.options?.length && !field.choices?.length) return `No available choices for ${field.label.toLowerCase()}. Skip this action or refresh access and try again.`;
  if (field.type === 'rich_text') return `Add text to ${field.label.toLowerCase()}; empty formatting does not count.`;
  if (field.type === 'date') return 'Enter a real date in YYYY-MM-DD format.';
  if (field.type === 'number') return `Enter a number${field.min !== undefined ? ` of at least ${field.min}` : ''}${field.max !== undefined ? ` and at most ${field.max}` : ''}.`;
  if (field.type === 'file') return 'Choose a file from this device.';
  if (field.type === 'boolean') return 'Choose Yes or No.';
  if (field.type === 'select') return `Choose ${field.label.toLowerCase()} from the available options.`;
  return `Enter ${field.label.toLowerCase()}.`;
}
export function reviewFields(action: ExtendedAction, options: VoiceOptions): VoiceReviewField[] {
  const definition = extendedActions[action.kind];
  return Object.entries(definition.fields).map(([name, field]): VoiceReviewField => {
    const f: VoiceField = field;
    return { ...f, name, options: f.source ? [...(options[f.source] ?? [])] : f.choices?.map((value) => ({ value, label: value })) };
  });
}

/** Model-supplied paths are always discarded; missing/ambiguous IDs become a picker. */
export function parseExtendedAction(candidate: unknown, options: VoiceOptions): ExtendedAction | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as { kind?: unknown; payload?: unknown; title?: unknown; summary?: unknown };
  if (typeof raw.kind !== 'string' || !isExtendedAction(raw.kind) || !raw.payload || typeof raw.payload !== 'object') return null;
  const definition = extendedActions[raw.kind];
  const payload: Record<string, VoiceValue> = {};
  for (const [name, field] of Object.entries(definition.fields)) {
    const f: VoiceField = field;
    const spoken = (raw.payload as Record<string, unknown>)[name];
    const value = f.type === 'rich_text' ? (typeof spoken === 'string' ? spokenRichText(spoken) : null) : spoken;
    payload[name] = f.type !== 'file' && fieldComplete({ ...f, options: f.source ? options[f.source] : undefined }, value)
      ? (value ?? null) as VoiceValue : null;
  }
  return { kind: raw.kind, title: definition.label, summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 1000) : definition.label, payload } as ExtendedAction;
}

export function validateExtendedAction(action: ExtendedAction, options: VoiceOptions): string[] {
  const payload = action.payload as Record<string, VoiceValue>;
  const errors = reviewFields(action, options).flatMap((field) => { const error = fieldError(field, payload[field.name]); return error ? [`${field.label}: ${error}`] : []; });
  const task = options.tasks?.find((row) => row.value === payload.taskId);
  const column = options.taskColumns?.find((row) => row.value === payload.columnId);
  if (task && column && task.parentId !== column.parentId) errors.push('Choose a status in the task’s own board.');
  if (action.kind === 'annotate_drawing' && (!Number.isInteger(payload.pageNo) || !options.drawings?.find((row) => row.value === payload.documentId)?.versionId)) errors.push('Choose an existing drawing revision and a whole page number.');
  if (['update_task', 'update_material_approval', 'edit_project_update'].includes(action.kind) && Object.entries(payload).filter(([key, value]) => (!key.endsWith('Id') || key === 'assigneeId') && value !== null && value !== '').length === 0) errors.push('Describe at least one change.');
  return errors;
}
