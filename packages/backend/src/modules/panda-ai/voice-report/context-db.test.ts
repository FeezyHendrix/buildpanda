import assert from 'node:assert/strict';
import { test } from 'node:test';
import knex from 'knex';
import Fastify from 'fastify';
import taskRoutes from '../../tasks/routes.ts';
import { ForbiddenError } from '../../../lib/errors.ts';
import { voiceContextRepository } from './context-repository.ts';
import type { VoiceCaller } from './context-types.ts';

const url = process.env.VOICE_TEST_DATABASE_URL;
test('voice target SQL respects project, assigned task, named reviewer and conversation membership scopes', { skip: !url }, async () => {
  const db = knex({ client: 'pg', connection: url });
  const tx = await db.transaction();
  try {
    await tx('user').insert(['crew', 'reviewer', 'outsider'].map((id) => ({ id: `voice-${id}`, name: id, email: `${id}@voice.invalid` })));
    await tx('organization').insert({ id: 'voice-org', name: 'Voice test', slug: 'voice-test' });
    await tx('member').insert(['crew', 'reviewer'].map((id) => ({ id: `voice-member-${id}`, organizationId: 'voice-org', userId: `voice-${id}` })));
    await tx('projects').insert(['site', 'other'].map((id) => ({ id: `voice-${id}`, name: id, address: 'Fixture', status: 'On Track', risk: 'Low', currency: 'NGN', organization_id: 'voice-org', owner_id: 'voice-reviewer' })));
    await tx('buildings').insert(['site', 'other'].map((id) => ({ id: `voice-building-${id}`, project_id: `voice-${id}`, name: id })));
    await tx('task_boards').insert(['site', 'other'].map((id) => ({ id: `voice-board-${id}`, project_id: `voice-${id}`, building_id: `voice-building-${id}` })));
    await tx('task_columns').insert(['site', 'other'].map((id) => ({ id: `voice-column-${id}`, board_id: `voice-board-${id}`, name: 'To do', status: 'Todo' })));
    await tx('tasks').insert(['assigned', 'unassigned', 'foreign'].map((id) => ({ id: `voice-task-${id}`, title: id, project_id: id === 'foreign' ? 'voice-other' : 'voice-site', building_id: `voice-building-${id === 'foreign' ? 'other' : 'site'}`, board_id: `voice-board-${id === 'foreign' ? 'other' : 'site'}`, column_id: `voice-column-${id === 'foreign' ? 'other' : 'site'}` })));
    await tx('task_assignees').insert({ task_id: 'voice-task-assigned', assignee_id: 'voice-crew' });
    await tx('approvals').insert([
      { id: 'voice-approval-own', project_id: 'voice-site', kind: 'material', title: 'Own request', requested_reviewer_id: 'voice-crew' },
      { id: 'voice-approval-other', project_id: 'voice-site', kind: 'material', title: 'Other reviewer', requested_reviewer_id: 'voice-reviewer' },
      { id: 'voice-approval-decided', project_id: 'voice-site', kind: 'material', title: 'Immutable', status: 'Approved' },
      { id: 'voice-approval-resubmit', project_id: 'voice-site', kind: 'material', title: 'Resubmit', status: 'Resubmit' },
    ]);
    await tx('channels').insert([
      { id: 'voice-channel', type: 'project', project_id: 'voice-site', name: 'Site' },
      { id: 'voice-secret', type: 'project', project_id: 'voice-site', name: 'Secret' },
      { id: 'voice-foreign', type: 'project', project_id: 'voice-other', name: 'Foreign' },
      { id: 'voice-dm', type: 'dm' },
    ]);
    await tx('channel_members').insert(['channel', 'foreign', 'dm'].map((id) => ({ id: `voice-member-${id}`, channel_id: `voice-${id}`, user_id: 'voice-crew' })));
    await tx('messages').insert(['channel', 'secret', 'foreign', 'dm'].map((id) => ({ id: `voice-message-${id}`, channel_id: `voice-${id}`, body: id })));
    const caller: VoiceCaller = { userId: 'voice-crew', organizationId: 'voice-org', can: (_resource, action) => action !== 'viewAll', workspaceCan: () => false, capabilities: { canAccessTaskBoard: true, canSeeFullTaskBoard: false } };
    const repository = voiceContextRepository(tx);
    const scoped = await repository.options('voice-site', caller);
    assert.deepEqual(scoped.tasks!.map((row) => row.value), ['voice-task-assigned']);
    assert.equal(scoped.taskColumns!.length, 1);
    assert.ok(scoped.decidableApprovals!.some((row) => row.value === 'voice-approval-own'));
    assert.ok(!scoped.decidableApprovals!.some((row) => row.value === 'voice-approval-other'));
    assert.deepEqual(scoped.reopenableApprovals!.map((row) => row.value), ['voice-approval-resubmit']);
    assert.ok(!scoped.editableApprovals!.some((row) => row.value === 'voice-approval-decided'));
    assert.deepEqual(scoped.sendableChannels!.map((row) => row.value), ['voice-channel']);
    assert.deepEqual(scoped.replyTargets!.map((row) => row.value), ['voice-message-channel']);
    const workspace = await repository.options('voice-site', { ...caller, can: () => true, workspaceCan: () => true, capabilities: { ...caller.capabilities, canSeeFullTaskBoard: true } });
    assert.equal(workspace.tasks!.length, 2);
    assert.deepEqual(new Set(workspace.sendableChannels!.map((row) => row.value)), new Set(['voice-channel', 'voice-dm']));
    assert.deepEqual(workspace.workspaceMembers!.map((row) => row.value), ['voice-reviewer']);
    const denied = await repository.options('voice-site', { ...caller, can: () => false });
    assert.ok(Object.values(denied).every((rows) => rows.length === 0));
    const app = Fastify({ logger: false });
    app.decorate('db', tx);
    let grants: Record<string, string[]> = { tasks: ['view', 'add'], comments: ['post'] };
    app.decorateRequest('requireAuth', function () { return { id: 'voice-crew', name: 'crew', email: 'crew@voice.invalid', emailVerified: true, image: null, role: 'user' }; });
    app.decorateRequest('requireProjectPermission', async function (id: string, resource: string, action: string) {
      if (!grants[resource]?.includes(action)) throw new ForbiddenError();
      return tx('projects').where({ id }).first();
    });
    app.addHook('onRequest', async (request) => {
      request.orgRoles = new Map([['voice-org', 'employee']]);
      request.orgPermissions = new Map([['voice-org', new Map(Object.entries(grants).map(([resource, actions]) => [resource, new Set(actions)]))]]);
      request.projectRoles = new Map(); request.projectGrants = new Map(); request.projectSectionPermissions = new Map();
    });
    await app.register(taskRoutes);
    try {
      const comment = (taskId: string) => app.inject({ method: 'POST', url: `/projects/voice-site/tasks/${taskId}/comments`, payload: { body: 'Voice comment' } });
      assert.equal((await comment('voice-task-unassigned')).statusCode, 403);
      assert.equal((await comment('voice-task-foreign')).statusCode, 404);
      assert.equal((await comment('voice-task-assigned')).statusCode, 201);
      grants = { comments: ['post'] };
      assert.equal((await comment('voice-task-assigned')).statusCode, 403);
      grants = { tasks: ['add'] };
      assert.equal((await app.inject({ method: 'PATCH', url: '/projects/voice-site/tasks/voice-task-assigned', payload: { title: 'Updated by voice' } })).statusCode, 403);
      grants = { tasks: ['view', 'add'] };
      assert.equal((await app.inject({ method: 'PATCH', url: '/projects/voice-site/tasks/voice-task-unassigned', payload: { title: 'Forbidden' } })).statusCode, 403);
      assert.equal((await app.inject({ method: 'PATCH', url: '/projects/voice-site/tasks/voice-task-assigned', payload: { title: 'Updated by voice' } })).statusCode, 200);
      grants = { tasks: ['view', 'remove'] };
      assert.equal((await app.inject({ method: 'DELETE', url: '/projects/voice-site/tasks/voice-task-foreign' })).statusCode, 404);
      assert.equal((await app.inject({ method: 'DELETE', url: '/projects/voice-site/tasks/voice-task-assigned' })).statusCode, 204);
    } finally { await app.close(); }

  } finally { await tx.rollback(); await db.destroy(); }
});
