import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extendedActions, voiceActions, parseExtendedAction, validateExtendedAction, type VoiceDefinition, type VoiceOptions } from '@buildpanda/voice-actions';
import { classifyTranscript } from './service.ts';
import { canCapture, canPropose } from './permissions.ts';
import { computeMissing } from './legacy-review.ts';
import { classifySystem } from './prompt.ts';
import type { ProjectSnapshot } from './types.ts';

const options: Record<string, { value: string; label: string; parentId: string; versionId: string }[]> = {};
for (const definition of Object.values(extendedActions)) for (const field of Object.values((definition as VoiceDefinition).fields)) {
  if (field.source) options[field.source] = [{ value: field.source + '-id', label: field.source + ' label', parentId: 'board', versionId: 'version' }];
}
const snapshot: ProjectSnapshot = { voiceOptions: options, rfis: [], changeRequests: [], materialOrders: [], lookAheads: [], activities: [], delayReasons: [], ledgerEntries: [], materials: [], todayEntries: [], stages: [], buildings: [], dailyLogForm: null, today: '2026-10-14' };
function candidate(kind: keyof typeof extendedActions) {
  const definition: VoiceDefinition = extendedActions[kind];
  const payload = Object.fromEntries(Object.entries(definition.fields).map(([key, field]) => [key,
    field.source ? field.source + '-id' : field.choices?.[0] ?? (field.type === 'number' ? Math.max(field.min ?? 0, 1) : field.type === 'date' ? '2026-10-14' : field.type === 'file' ? 'file:///model-secret' : 'Spoken text')]));
  return { kind, title: 'Voice action', summary: 'Review this action', payload };
}

test('every additional action classifies independently, with file selection left to the reviewer', async () => {
  const kinds = Object.keys(extendedActions) as (keyof typeof extendedActions)[];
  const actions = await classifyTranscript('A mixed site report', snapshot, async () => ({ actions: [...kinds.map(candidate), { kind: 'unknown', payload: {} }, 'malformed'] }));
  assert.equal(actions.length, 31);
  assert.deepEqual(actions.map((action) => action.kind), kinds);
  for (const action of actions) {
    if (action.kind === 'upload_document' || action.kind === 'upload_document_version') {
      assert.equal(action.payload.file, null);
      assert.deepEqual(action.missing.map((field) => field.name), ['file']);
    } else assert.equal(action.missing.length, 0, action.kind);
  }
});

test('unresolved or foreign records become required pickers instead of fabricated targets', async () => {
  const actions = await classifyTranscript('Send Ruth the delivery update and record the expense', snapshot, async () => ({ actions: [
    { kind: 'send_direct_message', payload: { userId: 'foreign-member', body: 'Delivery received' } },
    { kind: 'create_expense', payload: { title: 'Cement', amount: -5, transactedAt: '2026-02-30', category: 'foreign-category' } },
  ] }));
  assert.equal(actions.length, 2);
  assert.equal(actions[0]!.missing[0]!.name, 'userId');
  assert.deepEqual(new Set(actions[1]!.missing.map((field) => field.name)), new Set(['amount', 'category', 'transactedAt']));
});

test('permissions filter model definitions and returned actions, including malicious model output', async () => {
  const allowed = ['open_document']; let prompt = '';
  const actions = await classifyTranscript('Open the plan and delete a task', { ...snapshot, allowedActionKinds: allowed }, async (messages) => {
    prompt = String(messages[0]!.content);
    return { actions: [candidate('open_document'), candidate('delete_task')] };
  });
  assert.deepEqual(actions.map((action) => action.kind), ['open_document']);
  assert.match(prompt, /- "open_document":/);
  assert.doesNotMatch(prompt, /- "delete_task":/);
  assert.doesNotMatch(classifySystem([]), /^- "[a-z_]+":/m);
});

test('all 52 catalog entries deny unknown grants, and project grants cannot authorize a DM', () => {
  const capabilities = { canAccessTaskBoard: true };
  assert.equal(Object.keys(voiceActions).length, 52);
  for (const kind of Object.keys(voiceActions)) {
    const proposal = { kind, payload: {} } as Parameters<typeof canPropose>[0];
    assert.equal(canPropose(proposal, () => false, capabilities), false, kind);
    assert.equal(canPropose(proposal, () => true, capabilities, () => true), true, kind);
  }
  const dm = { kind: 'send_direct_message', payload: {} } as Parameters<typeof canPropose>[0];
  assert.equal(canPropose(dm, () => true, capabilities, () => false), false);
  assert.equal(canCapture(() => false), false);
  assert.equal(canCapture((r, a) => ['project', 'documents'].includes(r) && a === 'view'), true);
});

test('cross-board moves and obsolete drawing targets fail validation', () => {
  const move = parseExtendedAction(candidate('move_task'), options)!;
  const crossBoard: VoiceOptions = { ...options, taskColumns: [{ ...options.taskColumns![0]!, parentId: 'other-board' }] };
  assert.match(validateExtendedAction(move, crossBoard).join(' '), /own board/);
  const pin = parseExtendedAction(candidate('annotate_drawing'), options)!;
  assert.match(validateExtendedAction(pin, { ...options, drawings: [{ value: 'drawings-id', label: 'No revision' }] }).join(' '), /revision/);
});

test('daily-log review keeps the configured select and yes/no choices', () => {
  const withForm: ProjectSnapshot = { ...snapshot, dailyLogForm: { id: 'form', name: 'Site diary', fields: [
    { id: 'weather', label: 'Weather', type: 'select', required: true, helpText: null, unit: null, options: ['Sunny', 'Rainy'] },
    { id: 'safe', label: 'Safety inspection', type: 'yes_no', required: true, helpText: null, unit: null, options: [] },
  ] } };
  const fields = computeMissing({ kind: 'daily_log', title: 'Diary', summary: 'Site diary', payload: { templateId: 'form', bodyText: 'Site inspection', responses: {} } }, withForm);
  assert.deepEqual(fields[0]!.options?.map((option) => option.value), ['Sunny', 'Rainy']);
  assert.equal(fields[1]!.type, 'boolean');
});


test('missing required text and quantity survive classification for typed review', async () => {
  const actions = await classifyTranscript('Raise an RFI and order cement', snapshot, async () => ({ actions: [
    { kind: 'rfi', title: 'Question', summary: 'Ask the engineer', payload: { subject: null, question: null } },
    { kind: 'material_order', title: 'Cement', summary: 'Order cement', payload: { title: 'Cement', materialName: 'Cement', quantity: null, unit: null, neededBy: null } },
  ] }));
  assert.equal(actions.length, 2);
  assert.deepEqual(actions[0]!.missing.map((field) => [field.name, field.type]), [['subject', 'text'], ['question', 'rich_text']]);
  assert.deepEqual(actions[1]!.missing.map((field) => field.name), ['quantity', 'unit', 'neededBy']);
});

test('empty template answers remain reviewable with long-text, boolean and help text', async () => {
  const form: ProjectSnapshot = { ...snapshot, dailyLogForm: { id: 'form', name: 'Diary', fields: [
    { id: 'details', type: 'long_text', label: 'Work completed', required: true, helpText: 'Include locations', unit: null, options: [] },
    { id: 'safe', type: 'yes_no', label: 'Inspection done', required: true, helpText: null, unit: null, options: [] },
  ] } };
  const actions = await classifyTranscript('Fill the diary', form, async () => ({ actions: [{ kind: 'daily_log', title: 'Diary', summary: 'Fill diary', payload: { bodyText: '', templateId: 'form', responses: {} } }] }));
  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0]!.missing.map((field) => field.type), ['long_text', 'boolean']);
  assert.equal(actions[0]!.missing[0]!.helpText, 'Include locations');
});

test('spoken rich text is escaped and blank rich content still requires input', () => {
  const action = parseExtendedAction({ kind: 'respond_rfi', payload: { rfiId: 'respondableRfis-id', body: '<script>invented()</script> Use B20' } }, options)!;
  assert.equal(action.kind, 'respond_rfi');
  if (action.kind !== 'respond_rfi') return;
  assert.match(action.payload.body!.html, /&lt;script&gt;/);
  assert.equal(action.payload.body!.text, '<script>invented()</script> Use B20');
  const empty = parseExtendedAction({ kind: 'respond_rfi', payload: { rfiId: 'respondableRfis-id', body: '   ' } }, options)!;
  assert.match(validateExtendedAction(empty, options).join(' '), /Add text/);
});

test('legacy actions retain unresolved targets, hours and decisions for authorized review', async () => {
  const scoped: ProjectSnapshot = { ...snapshot, rfis: [{ id: 'rfi', number: 1, subject: 'Cover', status: 'Open' }], activities: [{ id: 'activity', name: 'Inspect slab', status: 'InProgress' }] };
  const actions = await classifyTranscript('Comment on the RFI and log work', scoped, async () => ({ actions: [
    { kind: 'comment_rfi', title: 'Comment', summary: 'Add a comment', payload: { rfiId: 'foreign', body: null } },
    { kind: 'transition_rfi', title: 'Status', summary: 'Change status', payload: { rfiId: null, status: null } },
    { kind: 'log_activity', title: 'Work', summary: 'Log work', payload: { activityId: null, hoursLogged: null } },
    { kind: 'update_daily_log', title: 'Hours', summary: 'Update hours', payload: { totalHours: null } },
    { kind: 'material_log', title: 'Material', summary: 'Record movement', payload: { entryType: null, materialName: 'Cement', quantity: 2, unit: 'bags' } },
  ] }));
  assert.equal(actions.length, 5);
  assert.deepEqual(actions[0]!.missing.map((f) => f.name), ['rfiId', 'body']);
  assert.deepEqual(actions[0]!.missing[0]!.options?.map((o) => o.value), ['rfi']);
  assert.deepEqual(actions[1]!.missing.map((f) => f.name), ['rfiId', 'status']);
  assert.deepEqual(actions[2]!.missing.map((f) => f.name), ['activityId', 'hoursLogged']);
  assert.deepEqual(actions[3]!.missing.map((f) => f.name), ['totalHours']);
  assert.deepEqual(actions[4]!.missing.map((f) => f.name), ['entryType']);
});
