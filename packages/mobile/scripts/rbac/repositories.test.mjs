import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import { database, authorize, scope, snapshot } from './fixtures.mjs';
import { rfisRepository } from '../../src/db/rfis-repository.ts';
import { materialApprovalsRepository } from '../../src/db/material-approvals-repository.ts';
import { requireDrawingReference } from '../../src/db/record-permissions.ts';
import { rfis, outbox, materialApprovals, documents, drawingMarkups } from '../../src/db/schema.ts';
import { requireOutboxAccess, outboxReadWhere } from '../../src/db/outbox-access.ts';
import { projectAccess, requireAccess, requireCurrentAccess } from '../../src/lib/project-access-store.ts';
import { features } from '../../src/lib/feature-access.ts';
import { clearProjectServerCache } from '../../src/db/access-cleanup.ts';

const draft = { subject: 'Confirm beam', question: 'Confirm the beam detail.' };

test('real SQLite reads are scoped and denied writes never create a record or outbox entry', async () => {
  const { db, raw } = database();
  try {
    db.insert(rfis).values([{ id: 'visible', projectId: 'site', ...draft }, { id: 'foreign', projectId: 'other', ...draft }]).run();
    authorize({ rfis: ['view'] });
    assert.equal(rfisRepository.byIdQuery(db, 'visible').get().id, 'visible');
    assert.equal(rfisRepository.byIdQuery(db, 'foreign').get(), undefined);
    await assert.rejects(rfisRepository.createLocal(db, 'site', draft), /permission/i);
    assert.equal(db.select().from(outbox).all().length, 0);
    assert.equal(db.select().from(rfis).all().length, 2);
    authorize({ rfis: ['view', 'create'] });
    const id = await rfisRepository.createLocal(db, 'site', draft);
    assert.ok(rfisRepository.byIdQuery(db, id).get());
    const queued = db.select().from(outbox).all();
    assert.equal(queued.length, 1);
    assert.equal(queued[0].entityId, id);
    projectAccess.invalidate('denied');
    assert.equal(rfisRepository.byIdQuery(db, id).get(), undefined);
    await assert.rejects(rfisRepository.createLocal(db, 'site', draft), /permission/i);
  } finally { raw.close(); }
});

test('another account database and stale asynchronous tickets cannot use current grants', async () => {
  const { db, raw } = database('other-user');
  try {
    authorize({ rfis: ['view', 'create'] });
    await assert.rejects(rfisRepository.createLocal(db, 'site', draft), /permission/i);
    const ticket = requireAccess('site', features.rfis.read);
    projectAccess.setScope({ ...scope, organizationId: 'other' });
    assert.throws(() => requireCurrentAccess(ticket), /changed/i);
    projectAccess.setScope(scope);
    assert.equal(projectAccess.accept(snapshot(), ticket.generation), false);
  } finally { raw.close(); }
});

test('revoked queued actions are quarantined, with scope checked again before dispatch or discard', async () => {
  const { db, raw } = database();
  try {
    authorize({ rfis: ['view', 'create'] });
    await rfisRepository.createLocal(db, 'site', draft);
    const item = db.select().from(outbox).get();
    assert.doesNotThrow(() => requireOutboxAccess(db, item));
    authorize({ rfis: ['view'] });
    assert.throws(() => requireOutboxAccess(db, item), /permission/i);
    assert.equal(db.select().from(outbox).all().length, 1);
    db.update(rfis).set({ projectId: 'other' }).where(eq(rfis.id, item.entityId)).run();
    assert.throws(() => requireOutboxAccess(db, item, false), /different project/i);
    projectAccess.invalidate('denied');
    assert.deepEqual(db.select().from(outbox).where(outboxReadWhere(db)).all(), []);
  } finally { raw.close(); }
});

test('material decisions enforce the requested reviewer before updating SQLite or enqueueing', async () => {
  const { db, raw } = database();
  try {
    authorize({ materials: ['view', 'approve'] });
    db.insert(materialApprovals).values({ id: 'approval', projectId: 'site', title: 'Concrete', materialName: 'Concrete', requestedReviewerId: 'reviewer' }).run();
    const decision = { status: 'Approved', response: 'Accepted', reviewerName: 'Crew' };
    await assert.rejects(materialApprovalsRepository.decideLocal(db, 'site', 'approval', decision), /requested reviewer/i);
    assert.equal(db.select().from(outbox).all().length, 0);
    assert.equal(db.select().from(materialApprovals).get().status, 'Pending');
    db.update(materialApprovals).set({ requestedReviewerId: 'crew' }).run();
    await materialApprovalsRepository.decideLocal(db, 'site', 'approval', decision);
    assert.equal(db.select().from(materialApprovals).get().status, 'Approved');
    assert.equal(db.select().from(outbox).get().operation, 'decision');
  } finally { raw.close(); }
});

test('denial cleanup removes server caches while retaining quarantined authored work', async () => {
  const { db, raw } = database();
  try {
    authorize({ rfis: ['view', 'create'] });
    const id = await rfisRepository.createLocal(db, 'site', draft);
    db.insert(rfis).values([{ id: 'server', projectId: 'site', ...draft }, { id: 'elsewhere', projectId: 'other', ...draft }]).run();
    projectAccess.invalidate('denied');
    clearProjectServerCache(db, 'site');
    assert.deepEqual(db.select({ id: rfis.id }).from(rfis).all().map((r) => r.id).sort(), ['elsewhere', id].sort());
    assert.equal(rfisRepository.byIdQuery(db, id).get(), undefined);
    assert.equal(db.select().from(outbox).all().length, 1);
  } finally { raw.close(); }
});

test('drawing references must match the authorized project and exact revision', () => {
  const { db, raw } = database();
  try {
    authorize({ documents: ['view'] });
    db.insert(documents).values({ id: 'document', projectId: 'site', fileName: 'Plan', size: '1KB', currentVersionId: 'revision' }).run();
    db.insert(drawingMarkups).values({ id: 'markup', projectId: 'site', documentId: 'different', documentVersionId: 'revision', pageNo: 1, kind: 'pin', geometry: '{}', color: 'red' }).run();
    assert.throws(() => requireDrawingReference(db, 'site', { documentId: 'document', documentVersionId: 'old' }), /revision/i);
    assert.throws(() => requireDrawingReference(db, 'site', { documentId: 'document', documentVersionId: 'revision', sourceMarkupId: 'markup' }), /revision/i);
  } finally { raw.close(); }
});

test('internal RFIs and proposed responses stay quarantined after company access is lost', async () => {
  const { db, raw } = database();
  try {
    authorize({ rfis: ['view', 'create'], comments: ['post'] });
    const internal = await rfisRepository.createLocal(db, 'site', draft);
    db.insert(rfis).values({ id: 'shared', projectId: 'site', ...draft, visibility: 'shared', status: 'Draft' }).run();
    const { rfiComments } = await import('../../src/db/schema.ts');
    const { rfiCommentsRepository } = await import('../../src/db/rfi-comments-repository.ts');
    db.insert(rfiComments).values([
      { id: 'visible-comment', rfiId: 'shared', projectId: 'site', body: 'Shared comment', isProposedResponse: false },
      { id: 'proposed', rfiId: 'shared', projectId: 'site', body: 'Internal proposal', isProposedResponse: true },
    ]).run();
    const queued = db.select().from(outbox).get();
    authorize({ rfis: ['view', 'create'], comments: ['post'] }, { capabilities: { canViewInternalRfis: false } });
    assert.equal(rfisRepository.byIdQuery(db, internal).get(), undefined);
    assert.equal(rfisRepository.byIdQuery(db, 'shared').get().id, 'shared', 'A shared draft remains visible');
    assert.deepEqual(rfiCommentsRepository.listQuery(db, 'shared').all().map((r) => r.id), ['visible-comment']);
    assert.deepEqual(db.select().from(outbox).where(outboxReadWhere(db)).all(), []);
    assert.throws(() => requireOutboxAccess(db, queued), /not available/i);
    await assert.rejects(rfiCommentsRepository.createLocal(db, 'site', internal, 'Blocked', 'Crew'), /not available/i);
    assert.equal(db.select().from(outbox).all().length, 1, 'Authored work is retained');
  } finally { raw.close(); }
});

// The daily-logs repository cannot be imported here: it pulls a runtime helper
// from @/api/daily-logs, which reaches react-native and expo-modules-core, and
// Node refuses to strip types under node_modules. So the void policy its guard
// resolves is asserted directly, on the same real database and grants.
test('the daily log void policy needs the void grant, keeps project scope, and stops on revocation', async () => {
  const { db, raw } = database();
  try {
    const { repositoryAccess } = await import('../../src/db/permissions.ts');
    const access = repositoryAccess(features.dailyLog);

    authorize({ dailyLog: ['view', 'create'] });
    assert.ok(access.require(db, 'site', 'create'), 'creating a note is granted');
    assert.throws(() => access.require(db, 'site', 'void'), /permission/i, 'create alone cannot void');
    assert.throws(() => access.transaction(db, 'site', 'void', () => 'written'), /permission/i);

    authorize({ dailyLog: ['view', 'void'] });
    assert.ok(access.require(db, 'site', 'void'));
    assert.equal(access.transaction(db, 'site', 'void', () => 'written'), 'written');
    assert.throws(() => access.require(db, 'other', 'void'), /permission/i, 'another project stays out of scope');

    projectAccess.invalidate('denied');
    assert.throws(() => access.require(db, 'site', 'void'), /permission/i);
  } finally { raw.close(); }
});
