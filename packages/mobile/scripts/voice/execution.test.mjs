import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extendedActions, voiceRequirement } from '@buildpanda/voice-actions';
import { executeVoiceAction, voiceHandlers } from '../../src/lib/voice/execute.ts';
import { projectAccess, requireAccess } from '../../src/lib/project-access-store.ts';
import { authorize } from '../rbac/fixtures.mjs';
import { action, context, database, options } from './fixtures.mjs';
import { calls, setResponder } from './transport.mjs';
import { outbox, tasks, taskColumns, documents, drawingMarkups, drawingMarkupComments, materialApprovals, materialOrders, rfis, expenses } from '../../src/db/schema.ts';
import { applyVoiceActionBatch } from '../../src/lib/voice-action-batch.ts';
import { mergeMissingValues, outstandingCount } from '../../src/lib/voice-missing-fields.ts';

const document = { id: 'document', fileName: 'Plan.pdf', size: '1 KB', currentVersionId: 'revision', group: 'plan' };
const task = { id: 'task', title: 'Inspect slab', columnId: 'column', priority: 'Medium', position: 0, assignees: [{ kind: 'user', id: 'crew', name: 'Crew' }], subtaskTotal: 0, subtaskDone: 0 };
function seed(db, kind) {
  db.insert(taskColumns).values({ id: 'column', projectId: 'site', buildingId: 'building', name: 'Done', status: 'Done' }).run();
  db.insert(tasks).values({ ...task, projectId: 'site', buildingId: 'building', assignees: JSON.stringify(task.assignees), assignedToMe: true }).run();
  db.insert(documents).values({ ...document, projectId: 'site' }).run();
  db.insert(drawingMarkups).values({ id: 'markup', projectId: 'site', documentId: 'document', documentVersionId: 'revision', pageNo: 1, kind: 'pin', geometry: '{"kind":"pin","at":{"x":50,"y":50}}', color: 'blue' }).run();
  db.insert(materialApprovals).values({ id: 'approval', projectId: 'site', title: 'Concrete', requestedReviewerId: 'crew', status: kind === 'reopen_material_approval' ? 'Resubmit' : 'Pending' }).run();
  db.insert(materialOrders).values({ id: 'order', projectId: 'site', title: 'Cement', quantity: 10, status: 'Approved' }).run();
  db.insert(rfis).values({ id: 'rfi', projectId: 'site', subject: 'Beam', question: 'Confirm dimensions', visibility: 'shared' }).run();
}
function responder(path, method, body) {
  if (path.includes('/tasks/board')) return { id: 'board', columns: [{ id: 'column', name: 'Done', status: 'Done', position: 0 }], tasks: [task] };
  if (path === '/projects/site/documents/document/versions' && method === 'GET') return [{ id: 'revision', versionNo: 1 }];
  if (path === '/projects/site/documents' && method === 'GET') return [document];
  if (path === '/messages/message') return { id: 'message', channelId: 'channel' };
  if (path === '/channels/dm') return { id: 'dm', type: 'dm', projectId: null, organizationId: null };
  if (path === '/channels/dm' || path === '/channels/channel') return { id: path.split('/').at(-1), type: path.endsWith('/dm') ? 'dm' : 'project', projectId: path.endsWith('/dm') ? null : 'site', organizationId: null };
  return { id: 'result', ...body };
}
for (const [kind, definition] of Object.entries(extendedActions)) test(`executes ${kind} through its real API/repository adapter`, async () => {
  const { db, raw } = database();
  try {
    seed(db, kind);
    setResponder(responder);
    const c = context(db, { online: definition.online === true });
    const result = await executeVoiceAction(action(kind), c);
    assert.equal(result.queued, !definition.online && kind !== 'open_document');
    assert.equal(result.notice, undefined, 'cache reconciliation must succeed');
    const pending = db.select().from(outbox).all();
    if (result.queued) assert.ok(pending.length > 0, 'write must be enqueued');
    else assert.equal(pending.length, 0);
    if (kind === 'create_expense') assert.equal(db.select().from(expenses).get().amount, 1);
    if (kind === 'annotate_drawing') {
      assert.equal(pending.length, 2, 'pin and comment enqueue atomically');
      assert.equal(db.select().from(drawingMarkupComments).get().body, 'Spoken detail');
    }
    if (kind === 'delete_task') assert.equal(db.select().from(tasks).all().length, 0);
    if (kind === 'delete_document') assert.equal(db.select().from(documents).all().length, 0);
    if (kind === 'rename_document') assert.equal(db.select().from(documents).get().fileName, 'Spoken detail');
    if (kind === 'reply_message') assert.equal(calls.at(-1).body.parentMessageId, 'message');
    if (kind === 'reopen_material_approval') assert.equal(db.select().from(materialApprovals).get().status, 'Pending');
  } finally { raw.close(); }
});

test('every new action denies missing permissions before any HTTP call or outbox write', async () => {
  assert.deepEqual(Object.keys(voiceHandlers).sort(), Object.keys(extendedActions).sort());
  const { db, raw } = database();
  try {
    for (const kind of Object.keys(extendedActions)) {
      context(db); authorize({ project: ['view'] }); setResponder(responder);
      const c = { db, projectId: 'site', online: true, options, ticket: projectAccess.getState() };
      await assert.rejects(executeVoiceAction(action(kind), c), /permission/);
      assert.equal(calls.length, 0); assert.equal(db.select().from(outbox).all().length, 0);
    }
  } finally { raw.close(); }
});

test('unknown, expired, switched and revoked access stop review execution', async () => {
  const { db, raw } = database();
  try {
    for (const invalidate of [() => projectAccess.invalidate('unknown'), () => projectAccess.invalidate('denied'), () => projectAccess.setScope({ userId: 'someone', organizationId: 'workspace', projectId: 'site' }), () => { projectAccess.getState().snapshot.verifiedAt -= 24 * 60 * 60 * 1000; }]) {
      const c = context(db); invalidate();
      await assert.rejects(executeVoiceAction(action('create_expense'), c), /permission|changed/);
      assert.equal(db.select().from(outbox).all().length, 0);
    }
  } finally { raw.close(); }
});

test('online-only actions reject offline and DMs never inherit project Messages grants', async () => {
  const { db, raw } = database();
  try {
    for (const [kind, definition] of Object.entries(extendedActions)) if (definition.online) await assert.rejects(executeVoiceAction(action(kind), context(db)), /Connect/);
    context(db); authorize({ project: ['view'], messages: ['view', 'send'] });
    const c = { db, projectId: 'site', online: true, options, ticket: projectAccess.getState() };
    await assert.rejects(executeVoiceAction(action('send_direct_message'), c), /permission/);
    setResponder(() => { throw new Error('Conversation membership revoked'); });
    await assert.rejects(executeVoiceAction(action('send_message'), context(db, { online: true })), /membership/);
    assert.equal(calls.some((call) => call.method === 'POST'), false);
  } finally { raw.close(); }
});

test('named reviewer, immutable decisions and drawing revision are checked before local effects', async () => {
  const { db, raw } = database();
  try {
    seed(db, 'decide_material_approval');
    const c = context(db);
    raw.exec("UPDATE material_approvals SET requested_reviewer_id = 'other'");
    await assert.rejects(executeVoiceAction(action('decide_material_approval'), c), /requested reviewer/);
    raw.exec("UPDATE material_approvals SET status = 'Approved'");
    await assert.rejects(executeVoiceAction(action('reopen_material_approval'), c), /already been decided/);
    await assert.rejects(executeVoiceAction(action('update_material_approval'), c), /immutable/);
    raw.exec("UPDATE documents SET current_version_id = 'new-revision'");
    await assert.rejects(executeVoiceAction(action('annotate_drawing'), c), /revision/);
    assert.equal(db.select().from(outbox).all().length, 0);
  } finally { raw.close(); }
});

test('edited IDs, dates and numbers cannot bypass review validation', () => {
  const expense = action('create_expense');
  for (const answers of [{ category: 'foreign' }, { amount: '-1' }, { transactedAt: '2026-02-30' }]) {
    assert.ok(outstandingCount([expense], new Set([0]), { 0: answers }) > 0);
  }
  const upload = action('upload_document'); upload.payload.file = null;
  assert.ok(outstandingCount([upload], new Set([0]), {}) > 0);
  const file = { uri: 'file:///picked.pdf', fileName: 'Picked.pdf', mimeType: 'application/pdf', size: 256 };
  assert.equal(mergeMissingValues(upload, { file }).payload.file, file);
  assert.equal(outstandingCount([upload], new Set([0]), { 0: { file } }), 0);
});

test('partial batches retain success and retry only unsuccessful actions', async () => {
  const completed = new Map(); const invocations = []; let fail = true;
  const items = ['create_expense', 'send_message', 'create_project_update'].map((kind, index) => ({ index, action: action(kind) }));
  const apply = async (proposal) => { invocations.push(proposal.kind); if (proposal.kind === 'send_message' && fail) throw new Error('Disconnected'); return { queued: true }; };
  await assert.rejects(applyVoiceActionBatch(items, completed, apply), /Disconnected/);
  assert.deepEqual([...completed.keys()], [0, 2]); fail = false;
  await applyVoiceActionBatch(items, completed, apply);
  assert.deepEqual(invocations, ['create_expense', 'send_message', 'create_project_update', 'send_message']);
});

test('rich responses preserve formatting and plain text in the real offline record and outbox', async () => {
  const { richTextFromHtml } = await import('@buildpanda/voice-actions');
  const { rfiComments } = await import('../../src/db/schema.ts');
  const { db, raw } = database();
  try {
    seed(db, 'respond_rfi');
    const proposal = action('respond_rfi');
    proposal.payload.body = richTextFromHtml('<p>Use <strong>B20</strong>.</p><ul><li>Inspect first</li></ul>');
    await executeVoiceAction(proposal, context(db));
    const saved = db.select().from(rfiComments).get();
    assert.equal(saved.body, 'Use B20. Inspect first');
    assert.equal(saved.contentHtml, proposal.payload.body.html);
    assert.ok(db.select().from(outbox).all().some(row => row.resource === 'rfi-comments'));
  } finally { raw.close(); }
});

test('required empty rich formatting and unsupported field types block application', async () => {
  const { richTextFromHtml, fieldComplete } = await import('@buildpanda/voice-actions');
  const proposal = action('respond_rfi');
  const empty = richTextFromHtml('<p><strong> </strong><br>&nbsp;&#160;\u200b</p>');
  assert.equal(outstandingCount([proposal], new Set([0]), { 0: { body: empty } }), 1);
  assert.equal(fieldComplete({ type: 'future-control', label: 'Unknown', required: false }, null), false);
  assert.equal(fieldComplete({ type: 'boolean', label: 'Safe', required: true }, false), true);
  assert.equal(fieldComplete({ type: 'boolean', label: 'Safe', required: true }, 'false'), false);
});

test('legacy rich edits update HTML and the plain-text mirror in the nested API patch', async () => {
  const { richTextFromHtml } = await import('@buildpanda/voice-actions');
  const proposal = { kind: 'update_rfi', title: 'RFI', summary: 'Edit question', payload: { rfiId: 'rfi', patch: { question: 'Old question' } }, missing: [] };
  const value = richTextFromHtml('<p>Confirm <em>cover</em> depth?</p>');
  const merged = mergeMissingValues(proposal, { 'patch.question': value });
  assert.equal(merged.payload.patch.question, 'Confirm cover depth?');
  assert.equal(merged.payload.patch.questionHtml, value.html);
  assert.equal(merged.payload.rfiId, 'rfi');
});

test('daily-form false answers and paragraphs survive review without string coercion', () => {
  const proposal = { kind: 'daily_log', title: 'Diary', summary: 'Site diary', payload: { templateId: 'form', bodyText: '', responses: {} }, missing: [
    { name: 'response:safe', label: 'Inspection complete', type: 'boolean', required: true },
    { name: 'response:details', label: 'Work completed', type: 'long_text', required: true },
  ] };
  const answers = { 'response:safe': false, 'response:details': 'Level 1 complete.\nLevel 2 remains.' };
  assert.equal(outstandingCount([proposal], new Set([0]), { 0: answers }), 0);
  const merged = mergeMissingValues(proposal, answers);
  assert.equal(merged.payload.responses.safe, false);
  assert.equal(merged.payload.responses.details, 'Level 1 complete.\nLevel 2 remains.');
  assert.equal(outstandingCount([merged], new Set([0]), {}), 0);
});
