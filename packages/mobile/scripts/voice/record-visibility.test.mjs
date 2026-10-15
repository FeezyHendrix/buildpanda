import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorize as setAccess, database, scope } from '../rbac/fixtures.mjs';
import { projectAccess } from '../../src/lib/project-access-store.ts';
import { tasksRepository } from '../../src/db/tasks-repository.ts';
import { expensesRepository } from '../../src/db/expenses-repository.ts';
import { serverActionCache } from '../../src/db/server-action-cache.ts';
import { tasks, taskColumns, expenses, outbox } from '../../src/db/schema.ts';
import { canReadCachedContentFile } from '../../src/db/content-file-access.ts';
const authorize = (grants) => setAccess(grants, { capabilities: { canAccessTaskBoard: true } });
const own = { project: ['view'], tasks: ['view', 'add', 'remove'], finances: ['viewCosts', 'manage'] };

test('SQLite task and expense reads, local writes and attachments enforce explicit visibility', async () => {
  const { db, raw } = database(); authorize(own);
  try {
    db.insert(taskColumns).values({ id: 'column', projectId: 'site', buildingId: 'building', name: 'To do', status: 'Todo' }).run();
    db.insert(tasks).values(['created', 'assigned', 'hidden', 'foreign'].map((id) => ({ id, projectId: id === 'foreign' ? 'other' : 'site', buildingId: 'building', columnId: 'column', title: id, createdById: id === 'created' ? 'crew' : 'other', assignedToMe: id === 'assigned', description: `![Photo](/files/task-${id}/download)` }))).run();
    db.insert(expenses).values(['created', 'hidden', 'unknown', 'foreign'].map((id) => ({ id, projectId: id === 'foreign' ? 'other' : 'site', title: id, createdById: id === 'created' ? 'crew' : id === 'unknown' ? null : 'other', category: 'materials', amount: 10, transactedAt: '2026-10-15' }))).run();
    const taskIds = () => tasksRepository.tasksQuery(db, 'site', 'building').all().map((row) => row.id);
    const expenseIds = () => expensesRepository.listQuery(db, 'site').all().map((row) => row.id);
    assert.deepEqual(new Set(taskIds()), new Set(['created', 'assigned'])); assert.deepEqual(expenseIds(), ['created']);
    assert.equal(await tasksRepository.findById(db, 'hidden'), undefined); assert.equal(await expensesRepository.findById(db, 'hidden'), undefined);
    assert.equal(canReadCachedContentFile(db, 'site', 'task-hidden'), false); assert.equal(canReadCachedContentFile(db, 'site', 'task-created'), true);
    await assert.rejects(tasksRepository.moveLocal(db, 'site', 'hidden', 'column')); assert.equal(db.select().from(outbox).all().length, 0);
    await serverActionCache.task(db, 'site', 'hidden', { title: 'Should not change' }); assert.equal(db.select().from(tasks).all().find((r) => r.id === 'hidden').title, 'hidden');
    const created = await tasksRepository.createLocal(db, 'site', 'building', { title: 'My offline task', description: null, dueDate: null, priority: 'Medium', assignees: [] }, 'spoofed');
    assert.equal((await tasksRepository.findById(db, created)).createdById, 'crew'); assert(taskIds().includes(created));
    authorize({ ...own, tasks: [...own.tasks, 'viewAll'], finances: [...own.finances, 'viewAllExpenses'] });
    assert.equal(taskIds().length, 4); assert.equal(expenseIds().length, 3); assert.equal(canReadCachedContentFile(db, 'site', 'task-hidden'), true);
    authorize(own); assert.equal(taskIds().length, 3); assert.deepEqual(expenseIds(), ['created']);
    for (const state of ['unknown', 'expired', 'denied']) {
      projectAccess.invalidate(state); assert.deepEqual(taskIds(), []); assert.deepEqual(expenseIds(), []);
      await assert.rejects(tasksRepository.moveLocal(db, 'site', 'created', 'column'));
    }
    authorize(own); projectAccess.setScope({ ...scope, userId: 'other' }); assert.deepEqual(taskIds(), []); assert.deepEqual(expenseIds(), []);
  } finally { raw.close(); }
});
