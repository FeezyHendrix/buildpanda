import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { eligibleSnapshot, OFFLINE_ACCESS_MS, canDecideMaterial } from '../../src/lib/access-policy.ts';
import { permits } from '../../src/lib/access-requirement.ts';
import { features } from '../../src/lib/feature-access.ts';
import { routePermission } from '../../src/lib/mobile-routes.ts';
import { apiRequirement } from '../../src/lib/api-access.ts';
import { outboxRequirement } from '../../src/db/outbox-access.ts';
import { scope, snapshot } from './fixtures.mjs';
import { canViewSection, canViewResource, canResourceAction } from '../../../frontend/src/lib/project-types/project-access.ts';
const can = (policy, grants = {}, workspace = {}, capabilities = {}) => permits(policy, (r, a) => grants[r]?.includes(a) === true, capabilities, (r, a) => workspace[r]?.includes(a) === true);

test('offline access expires at exactly 24 hours and rejects wrong scope, future dates and malformed maps', () => {
  const saved = snapshot({ documents: ['view'] });
  assert.equal(eligibleSnapshot(saved, scope, saved.verifiedAt + OFFLINE_ACCESS_MS - 1), true);
  assert.equal(eligibleSnapshot(saved, scope, saved.verifiedAt + OFFLINE_ACCESS_MS), false);
  assert.equal(eligibleSnapshot(saved, scope, saved.verifiedAt - 1), false);
  for (const key of ['userId', 'organizationId', 'projectId']) assert.equal(eligibleSnapshot(saved, { ...scope, [key]: 'other' }), false);
  for (const permissions of [null, [], { documents: 'view' }]) assert.equal(eligibleSnapshot({ ...saved, permissions }, scope), false);
});

test('read-only views, creation deep links, API and outbox policies agree', () => {
  const reader = { rfis: ['view'] };
  assert.equal(can(routePermission('/tools/rfis/123'), reader), true);
  for (const requirement of [routePermission('/tools/rfis/new'), apiRequirement('/projects/site/rfis', 'POST'), outboxRequirement({ resource: 'rfis', operation: 'create' })]) {
    assert.equal(can(requirement, reader), false);
    assert.equal(can(requirement, { rfis: ['view', 'create'] }), true);
  }
  assert.equal(can(features.documents.actions.create, { documents: ['view', 'manage'] }), false);
  assert.equal(can(routePermission('/tools/future-secret-feature'), { project: ['view'] }), false);
});

test('workspace messaging does not inherit project messages grants', () => {
  assert.equal(can(routePermission('/messages/new'), { messages: ['view', 'send'] }), false);
  assert.equal(can(routePermission('/messages/new'), {}, { messages: ['view'] }), false);
  assert.equal(can(routePermission('/messages/new'), {}, { messages: ['view', 'send'] }), true);
  assert.equal(can(routePermission('/messages/chat'), {}, { messages: ['view'] }), true);
});

test('named reviewer and exact decision grants remain separate from read access', () => {
  const pending = { status: 'Pending', requestedReviewerId: 'crew' };
  assert.equal(canDecideMaterial({ materials: ['approve'] }, 'crew', pending), true);
  assert.equal(canDecideMaterial({ materials: ['manage'] }, 'crew', pending), false);
  assert.equal(canDecideMaterial({ materials: ['approve'] }, 'someone', pending), false);
  assert.equal(canDecideMaterial({ materials: ['approve'] }, 'crew', { ...pending, status: 'Approved' }), false);
});

test('every protected route declares a guard and a policy', () => {
  const root = new URL('../../src/app/', import.meta.url);
  const files = readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.tsx') && !file.endsWith('_layout.tsx') && (file.startsWith('tools/') || file.startsWith('messages/') || file.startsWith('(tabs)/') || ['capture.tsx', 'sync.tsx'].includes(file)));
  for (const file of files) {
    if (file === '(tabs)/account.tsx') continue;
    const text = readFileSync(new URL(file, root), 'utf8');
    assert.match(text, /withProjectPermission\(/, file);
    const path = file.replace(/\.tsx$/, '').replace(/\(tabs\)\//, '');
    assert.equal(can(routePermission(path), new Proxy({}, { get: () => ['view', 'viewCosts', 'manage', 'create', 'post', 'request', 'upload', 'send', 'approve', 'add'] }), { messages: ['view', 'send'] }, { canAccessTaskBoard: true }), true, file);
  }
});

test('web helpers deny unknown access and require the exact action', () => {
  assert.equal(canViewSection(undefined, 'plans', 'documents'), false);
  assert.equal(canViewResource(undefined, 'documents'), false);
  assert.equal(canResourceAction(undefined, 'documents', 'upload'), false);
  assert.equal(canResourceAction({ permissions: { documents: ['manage'] } }, 'documents', 'upload'), false);
  assert.equal(canViewResource({ permissions: { documents: ['view'] } }, 'documents'), true);
});
