import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorize, database, scope, snapshot } from '../rbac/fixtures.mjs';
import { calls, setResponder } from './transport.mjs';
import { projectAccess } from '../../src/lib/project-access-store.ts';
import { updateCommentsRepository as comments } from '../../src/db/update-comments-repository.ts';
import { updatesRepository } from '../../src/db/updates-repository.ts';
import { pushUpdateCommentOutboxItem } from '../../src/db/outbox-update-comments.ts';
import { outbox, projectUpdates, updateComments } from '../../src/db/schema.ts';
import { canReadCachedContentFile } from '../../src/db/content-file-access.ts';

const grants = { project: ['view'], updates: ['view', 'post'], comments: ['post'] };
const parent = (id = 'update', projectId = 'site') => ({ id, projectId, category: 'Progress', title: 'Pour complete', description: 'Site report', createdAt: new Date().toISOString() });
const input = { bodyHtml: '<p>Check the <b>beam</b>.</p>', authorName: 'Crew', audio: { uri: 'file:///capture.m4a', mimeType: 'audio/m4a', durationSeconds: 8 } };

test('comments stage originals, retain uploads across retries and reconcile once', async () => {
  const { db, raw } = database(); authorize(grants); db.insert(projectUpdates).values(parent()).run();
  try {
    await comments.addLocal(db, 'site', 'update', input);
    let local = comments.listQuery(db, 'site', 'update').get();
    assert.match(local.stagedAudioUri, /s-crew\/s-workspace\/s-site\/media\//);
    assert.equal(local.authorId, 'crew'); assert.equal(local.body, 'Check the beam.');
    const item = db.select().from(outbox).get();
    setResponder(async () => { throw new Error('Temporary failure'); });
    await assert.rejects(pushUpdateCommentOutboxItem(db, item), /Temporary failure/);
    local = comments.find(db, 'site', local.id);
    assert.equal(local.audioFileId, 'file-uploaded'); assert.equal(local.isPendingSync, true);
    // A persisted upload must be reused even if its original is now inaccessible.
    db.update(updateComments).set({ stagedAudioUri: null }).run();
    setResponder(async (path, method, body) => {
      assert.equal(method, 'POST'); assert.match(path, /updates\/update\/comments$/);
      assert.equal(body.audioFileId, 'file-uploaded'); assert.equal(body.clientMutationId, local.id);
      return { id: 'saved', updateId: 'update', ...body, author: { id: 'crew', name: 'Crew' }, createdAt: new Date().toISOString() };
    });
    assert.equal((await pushUpdateCommentOutboxItem(db, item)).pushed, true);
    assert.equal(db.select().from(outbox).all().length, 0);
    const saved = comments.listQuery(db, 'site', 'update').all(); assert.equal(saved.length, 1); assert.equal(saved[0].isPendingSync, false);
    assert.equal(canReadCachedContentFile(db, 'site', 'file-uploaded'), true);
    authorize({ project: ['view'], updates: ['view'] });
    assert.equal(comments.listQuery(db, 'site', 'update').all().length, 1);
    await assert.rejects(comments.addLocal(db, 'site', 'update', input));
    authorize({}); assert.equal(comments.listQuery(db, 'site', 'update').all().length, 0);
    assert.equal(canReadCachedContentFile(db, 'site', 'file-uploaded'), false);
  } finally { raw.close(); }
});

test('comment writes reject unknown, expired and foreign scope; local parents remap before sync', async () => {
  const { db, raw } = database(); authorize(grants);
  db.insert(projectUpdates).values([parent('local_post'), parent('foreign', 'other')]).run();
  try {
    await assert.rejects(comments.addLocal(db, 'site', 'foreign', input));
    await assert.rejects(comments.addLocal(db, 'site', 'local_post', { ...input, audio: { ...input.audio, durationSeconds: 301 } }));
    await assert.rejects(comments.addLocal(db, 'site', 'local_post', { ...input, bodyHtml: '', audio: null }));
    for (const state of ['unknown', 'expired']) {
      projectAccess.invalidate(state);
      await assert.rejects(comments.addLocal(db, 'site', 'local_post', input));
    }
    authorize(grants); await comments.addLocal(db, 'site', 'local_post', input);
    const item = db.select().from(outbox).get(); setResponder(async () => { throw new Error('must not dispatch'); });
    assert.equal((await pushUpdateCommentOutboxItem(db, item)).pushed, false); assert.equal(calls.length, 0);
    await updatesRepository.reconcileCreate(db, 'site', 'local_post', { ...parent('server_post'), author: { name: 'Crew', role: '' }, media: [], status: 'Open' });
    assert.equal(comments.find(db, 'site', item.entityId).updateId, 'server_post');
    assert.equal(db.select().from(projectUpdates).all().find((r) => r.id === 'server_post').localId, 'local_post');
    projectAccess.setScope({ ...scope, projectId: 'other' });
    projectAccess.accept(snapshot(grants, { projectId: 'other' }), projectAccess.getState().generation);
    await assert.rejects(pushUpdateCommentOutboxItem(db, item)); assert.equal(calls.length, 0);
    authorize(grants); db.delete(projectUpdates).run();
    assert.equal(comments.listQuery(db, 'site', 'server_post').all().length, 0);
    await assert.rejects(pushUpdateCommentOutboxItem(db, item));
  } finally { raw.close(); }
});
