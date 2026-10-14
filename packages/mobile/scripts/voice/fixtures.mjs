import { extendedActions, parseExtendedAction } from '@buildpanda/voice-actions';
import { authorize, database } from '../rbac/fixtures.mjs';
import { requireAccess } from '../../src/lib/project-access-store.ts';
import { features } from '../../src/lib/feature-access.ts';
export { database };
export const grants = {
  project: ['view'], tasks: ['view', 'add', 'remove'], finances: ['viewCosts', 'manage'],
  materials: ['view', 'request', 'approve', 'manage'], comments: ['post'], documents: ['view', 'upload', 'delete', 'markup'],
  updates: ['view', 'post'], rfis: ['view', 'respond', 'manage'], messages: ['view', 'send'],
};
export const options = {
  buildings: [{ value: 'building', label: 'North block' }],
  tasks: [{ value: 'task', label: 'Inspect slab', parentId: 'board', buildingId: 'building' }],
  taskColumns: [{ value: 'column', label: 'Done', parentId: 'board', buildingId: 'building' }],
  assignees: [{ value: 'crew', label: 'Crew' }], reviewers: [{ value: 'crew', label: 'Crew' }],
  stages: [{ value: 'stage', label: 'Foundations' }],
  materialApprovals: [{ value: 'approval', label: 'Concrete' }], editableApprovals: [{ value: 'approval', label: 'Concrete' }],
  pendingApprovals: [{ value: 'approval', label: 'Concrete' }], decidableApprovals: [{ value: 'approval', label: 'Concrete' }],
  reopenableApprovals: [{ value: 'approval', label: 'Concrete' }],
  receivableOrders: [{ value: 'order', label: 'Cement order' }], respondableRfis: [{ value: 'rfi', label: 'RFI-1' }],
  expenseCategories: [{ value: 'materials', label: 'Materials' }],
  sendableChannels: [{ value: 'channel', label: 'Site team' }], workspaceMembers: [{ value: 'recipient', label: 'Ruth' }],
  replyTargets: [{ value: 'message', label: 'Delivery arrived', parentId: 'channel' }],
  updates: [{ value: 'update', label: 'Site progress' }],
  documents: [{ value: 'document', label: 'Plan.pdf', versionId: 'revision' }], drawings: [{ value: 'document', label: 'Plan.pdf', versionId: 'revision' }],
  documentCategories: [{ value: 'category', label: 'Plans', group: 'plan' }],
  markups: [{ value: 'markup', label: 'Plan pin', parentId: 'document', versionId: 'revision' }],
};
export function action(kind, patch = {}) {
  const payload = {};
  for (const [key, field] of Object.entries(extendedActions[kind].fields)) {
    payload[key] = field.source ? options[field.source][0].value : field.choices ? field.choices[0] : field.type === 'number' ? Math.max(field.min ?? 0, 1) : field.type === 'date' ? '2026-10-14' : 'Spoken detail';
  }
  const parsed = parseExtendedAction({ kind, payload: { ...payload, ...patch } }, options);
  if ('file' in parsed.payload) parsed.payload.file = { uri: 'file:///picked.pdf', fileName: 'Plan.pdf', mimeType: 'application/pdf', size: 256 };
  return { ...parsed, missing: [], reviewOptions: options };
}
export function context(db, extra = {}) {
  authorize(grants, { workspacePermissions: { messages: ['view', 'send'] }, capabilities: { canAccessTaskBoard: true, canSeeFullTaskBoard: true, canViewInternalRfis: true } });
  return { db, projectId: 'site', userId: 'crew', authorName: 'Crew', online: false, options, ticket: requireAccess('site', features.project.read), ...extra };
}
