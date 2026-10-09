import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conversationName, isSendableMessage, mergeMessages, messageDraftKey, visibleChannels } from '../src/lib/messaging.ts';

test('new snapshots replace edits and deletion tombstones without duplicating paged messages', () => {
  const older = [{ id: 'a', createdAt: '2026-10-01', body: 'old' }, { id: 'b', createdAt: '2026-10-02', body: 'second' }];
  const fresh = [{ id: 'b', createdAt: '2026-10-02', body: '', deletedAt: '2026-10-03' }, { id: 'c', createdAt: '2026-10-03', body: 'new' }];
  const merged = mergeMessages(older, fresh);
  assert.deepEqual(merged.map(row => row.id), ['a', 'b', 'c']);
  assert.equal(merged[1].body, '');
  assert.equal(merged[1].deletedAt, '2026-10-03');
  assert.equal(older[1].body, 'second');
});

test('inbox combines project and personal conversations without leaking other workspace channels', () => {
  const base = { archivedAt: null, updatedAt: '2026-10-01' };
  const project = { ...base, id: 'project', type: 'project', projectId: 'p1', unreadCount: 1 };
  const channels = [project, { ...base, id: 'other-project', type: 'project', projectId: 'p2' },
    { ...base, id: 'org', type: 'org', organizationId: 'o1' }, { ...base, id: 'other-org', type: 'org', organizationId: 'o2' },
    { ...base, id: 'dm', type: 'dm' }, { ...base, id: 'archived', type: 'project', projectId: 'p1', archivedAt: '2026-10-02' }];
  const result = visibleChannels(channels, [{ ...project, unreadCount: 0 }], 'p1', 'o1');
  assert.deepEqual(new Set(result.map(row => row.id)), new Set(['project', 'org', 'dm']));
  assert.equal(result.find(row => row.id === 'project').unreadCount, 0);
});

test('direct messages use recipient names with an email fallback and omit the signed-in member', () => {
  const people = [{ id: 'me', name: 'My name' }, { id: 'recipient', name: null, email: 'teammate@example.test' }];
  assert.equal(conversationName({ type: 'dm', name: null }, people, 'me'), 'teammate@example.test');
  assert.equal(conversationName({ type: 'project', name: 'general' }, people, 'me'), 'general');
});

test('drafts are isolated by account, workspace, conversation and thread with collision-safe keys', () => {
  const keys = [messageDraftKey('alice', 'org', 'room'), messageDraftKey('bob', 'org', 'room'),
    messageDraftKey('alice', 'other-org', 'room'), messageDraftKey('alice', 'org', 'other-room'),
    messageDraftKey('alice', 'org', 'room', 'thread'), messageDraftKey('alice_org', 'room', ''),
    messageDraftKey('alice', 'org_room', '')];
  assert.equal(new Set(keys).size, keys.length);
});

test('composer rejects blank and oversized messages while preserving multiline text', () => {
  assert.equal(isSendableMessage(' \n\t '), false);
  assert.equal(isSendableMessage('Pour complete.\nInspection at 9am.'), true);
  assert.equal(isSendableMessage('x'.repeat(8000)), true);
  assert.equal(isSendableMessage('x'.repeat(8001)), false);
});
