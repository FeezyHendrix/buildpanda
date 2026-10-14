import { textField as text, longTextField as longText, richTextField as richText, numberField as number, dateField as date, choiceField as choice, targetField as target, type VoiceField, type VoiceReviewField } from './types.ts';

const rich = (label: string, htmlField: string, required = true) => ({ ...richText(label, required), htmlField });
/** Field semantics mirror the existing record forms, including their HTML mirrors. */
const rfi = { rfiId: target('RFI', 'rfis') };
const change = { changeRequestId: target('Change request', 'changeRequests') };
const order = { orderId: target('Material order', 'materialOrders') };
const lookAhead = { lookAheadId: target('Look ahead', 'lookAheads') };
const fields: Record<string, Record<string, VoiceField>> = {
  rfi: { subject: text('Subject'), question: rich('Question', 'questionHtml'), priority: choice('Priority', ['Low', 'Normal', 'High'], false) },
  change_request: { title: text('Title'), description: rich('Description', 'descriptionHtml', false), reason: longText('Reason', false) },
  daily_log: { bodyText: rich('Diary note', 'bodyHtml') },
  material_log: { materialName: text('Material'), quantity: number('Quantity', 0.001), unit: text('Unit'), entryType: choice('Movement', ['IN', 'USED']), reason: rich('Notes', 'notesHtml', false) },
  material_order: { title: text('Title'), materialName: text('Material'), quantity: number('Quantity', 0.001), unit: text('Unit'), neededBy: date('Needed by'), supplier: text('Supplier', false) },
  look_ahead: { name: text('Name'), description: longText('Description', false), startDate: date('Start date'), endDate: date('End date'), totalWorkers: { ...number('Workers'), required: false } },
  update_rfi: { ...rfi, 'patch.subject': text('Subject'), 'patch.question': rich('Question', 'patch.questionHtml'), 'patch.dueDate': date('Due date', false) },
  update_change_request: { ...change, 'patch.title': text('Title'), 'patch.description': rich('Description', 'patch.descriptionHtml', false), 'patch.reason': longText('Reason', false), 'patch.costImpact': { type: 'number', label: 'Cost impact', required: false }, 'patch.timeImpactDays': { type: 'number', label: 'Time impact (days)', required: false } },
  update_material_order: { ...order, 'patch.title': text('Title'), 'patch.materialName': text('Material'), 'patch.quantity': { ...number('Quantity', 0.001), required: false }, 'patch.unit': text('Unit'), 'patch.supplier': text('Supplier', false) },
  update_look_ahead: { ...lookAhead, 'patch.name': text('Name'), 'patch.description': longText('Description', false), 'patch.startDate': date('Start date', false), 'patch.endDate': date('End date', false), 'patch.totalWorkers': { ...number('Workers'), required: false } },
  transition_rfi: { ...rfi, status: choice('New status', ['Closed', 'Void', 'Open']) },
  delete_change_request: change,
  delete_material_order: order,
  delete_look_ahead: lookAhead,
  update_daily_log: { totalHours: number('Total hours') },
  log_activity: { activityId: target('Activity', 'activities'), hoursLogged: number('Hours worked'), delayNote: longText('Delay note', false) },
  comment_rfi: { ...rfi, body: rich('Comment', 'contentHtml') },
  comment_change_request: { ...change, body: longText('Comment') },
  void_ledger_entry: { entryId: target('Material entry', 'ledgerEntries'), reason: longText('Reason for voiding') },
  void_daily_log_entry: { entryId: target('Diary entry', 'todayEntries'), reason: longText('Reason for voiding') },
};

export function readVoicePath(payload: object, path: string): unknown {
  if (path.startsWith('response:')) {
    const values = payload as Record<string, unknown>;
    return values[path] ?? (values.responses as Record<string, unknown> | undefined)?.[path.slice(9)];
  }
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, payload);
}

export function legacyReviewFields(action: { kind: string; payload: object }): VoiceReviewField[] {
  return Object.entries(fields[action.kind] ?? {})
    // An edit only exposes the requested patch; a blank optional field must not clear a record.
    .filter(([name]) => !name.startsWith('patch.') || readVoicePath(action.payload, name) !== undefined)
    .map(([name, field]) => ({ ...field, name, ...(action.kind === 'daily_log' && 'templateId' in action.payload && action.payload.templateId ? { required: false } : {}) }));
}
