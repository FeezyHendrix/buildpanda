import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { effectiveStageId, matchesStage, validStageId, stageStorageKey } from '../src/lib/stage-filter.ts';

const stages = new Map([['activity-a', 'foundation'], ['activity-b', 'shell']]);

test('explicit stage wins over activity fallback; All includes unassigned records', () => {
  assert.equal(effectiveStageId({ stageId: 'shell', activityId: 'activity-a' }, stages), 'shell');
  assert.equal(effectiveStageId({ stageId: null, activityId: 'activity-a' }, stages), 'foundation');
  assert.equal(matchesStage(effectiveStageId({ activityId: 'missing' }, stages), 'foundation'), false);
  assert.equal(matchesStage(null, undefined), true);
  assert.equal(matchesStage(undefined, undefined), true);
});

test('cached rows can be filtered repeatedly offline without modifying the complete cache', () => {
  const cached = [{ id: 'a', stageId: 'foundation' }, { id: 'b', activityId: 'activity-b' }, { id: 'c' }];
  const select = (stage) => cached.filter((row) => matchesStage(effectiveStageId(row, stages), stage)).map((row) => row.id);
  assert.deepEqual(select('foundation'), ['a']);
  assert.deepEqual(select('shell'), ['b']);
  assert.deepEqual(select('missing'), []);
  assert.deepEqual(select(undefined), ['a', 'b', 'c']);
});

test('scope survives missing network data but resets for deleted or other-building stages', () => {
  assert.equal(validStageId('foundation', undefined), 'foundation');
  assert.equal(validStageId('foundation', [{ id: 'foundation' }]), 'foundation');
  assert.equal(validStageId('foundation', [{ id: 'shell' }]), undefined);
  assert.equal(validStageId('foundation', []), undefined);
});

test('storage partitions by account, workspace, and project with valid SecureStore keys', () => {
  const keys = [stageStorageKey('alice', 'org', 'site'), stageStorageKey('bob', 'org', 'site'),
    stageStorageKey('alice', 'org2', 'site'), stageStorageKey('alice', 'org', 'site2'),
    stageStorageKey('alice_org', 'site', ''), stageStorageKey('alice', 'org_site', ''),
    stageStorageKey('user@example.com', 'workspace/1', 'site:west')];
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) assert.match(key, /^[a-zA-Z0-9._-]+$/);
});

test('SQLite upgrade preserves existing unsynced records and supports offline RFI stage joins', () => {
  const db = new DatabaseSync(':memory:');
  const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  for (const entry of journal.entries.filter((entry) => entry.idx < 21)) {
    db.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), 'utf8'));
  }
  db.exec("INSERT INTO change_requests(id, project_id, title, is_pending_sync) VALUES ('change', 'project', 'Unsynced change', 1)");
  const before = db.prepare('SELECT * FROM change_requests').get();
  db.exec(readFileSync(new URL('../drizzle/0021_stage_scope.sql', import.meta.url), 'utf8'));
  const after = db.prepare('SELECT * FROM change_requests').get();
  const { stage_id, ...preserved } = after;
  assert.equal(stage_id, null);
  assert.deepEqual(preserved, { ...before });
  db.exec("UPDATE change_requests SET stage_id = 'foundation' WHERE id = 'change'");
  db.exec("INSERT INTO rfis(id, project_id, number, subject, question, change_request_id) VALUES ('rfi', 'project', 1, 'Clarify', 'Which detail?', 'change')");
  const linked = db.prepare('SELECT c.stage_id FROM rfis r JOIN change_requests c ON c.id = r.change_request_id AND c.project_id = r.project_id').get();
  assert.equal(linked.stage_id, 'foundation');
  db.close();
});

test('v2 typefaces are bundled and semantic status colors are readable', () => {
  const { colors } = JSON.parse(readFileSync(new URL('../src/constants/design-tokens.json', import.meta.url), 'utf8'));
  assert.equal(colors.success[500], '#008236');
  assert.equal(colors.error[500], '#C10007');
  assert.equal(colors.warning[500], '#BB4D00');
  for (const name of ['Inter_400Regular', 'Inter_600SemiBold', 'Archivo_600SemiBold', 'Archivo_700Bold']) {
    const font = readFileSync(new URL(`../assets/fonts/${name}.ttf`, import.meta.url));
    assert.ok(font.length > 10000);
    assert.equal(font.readUInt32BE(0), 0x00010000);
  }
});
