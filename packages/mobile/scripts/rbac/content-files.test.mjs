import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorize, database, scope } from './fixtures.mjs';
import { canReadCachedContentFile } from '../../src/db/content-file-access.ts';
import { projectAccess } from '../../src/lib/project-access-store.ts';
import { imageHtml, appendImage } from '../../../rich-content/src/index.ts';

test('offline images require a readable record, current grants and the database owner', () => {
  const { db, raw } = database();
  try {
    raw.prepare('INSERT INTO rfis(id,project_id,subject,question,question_html,visibility) VALUES(?,?,?,?,?,?)')
      .run('private', 'site', 'Question', '', imageHtml({ fileId: 'private_file', name: 'Drawing' }), 'internal');
    raw.prepare('INSERT INTO rfis(id,project_id,subject,question,visibility) VALUES(?,?,?,?,?)')
      .run('public', 'site', 'Question', appendImage('', { fileId: 'shared_file', name: 'Site' }), 'shared');
    authorize({ rfis: ['view'] }, { capabilities: { canViewInternalRfis: false } });
    assert.equal(canReadCachedContentFile(db, 'site', 'shared_file'), true);
    assert.equal(canReadCachedContentFile(db, 'site', 'private_file'), false);
    assert.equal(canReadCachedContentFile(db, 'other', 'shared_file'), false);
    assert.equal(canReadCachedContentFile(db, 'site', 'sharedXfile'), false);
    authorize({ rfis: ['view'] });
    assert.equal(canReadCachedContentFile(db, 'site', 'private_file'), true);
    authorize({});
    assert.equal(canReadCachedContentFile(db, 'site', 'private_file'), false);
    authorize({ rfis: ['view'] }, { verifiedAt: Date.now() - 24 * 60 * 60 * 1000 });
    assert.equal(canReadCachedContentFile(db, 'site', 'private_file'), false);
    authorize({ rfis: ['view'] });
    projectAccess.setScope({ ...scope, userId: 'someone-else' });
    assert.equal(canReadCachedContentFile(db, 'site', 'private_file'), false);
  } finally { raw.close(); }
});

test('losing a task assignment immediately blocks its downloaded image without changing project grants', () => {
  const { db, raw } = database();
  try {
    raw.prepare('INSERT INTO tasks(id,project_id,building_id,column_id,title,description_html,assigned_to_me) VALUES(?,?,?,?,?,?,?)')
      .run('task', 'site', 'block', 'column', 'Check beam', imageHtml({ fileId: 'beam', name: 'Beam' }), 1);
    authorize({ tasks: ['view'] }, { capabilities: { canAccessTaskBoard: true, canSeeFullTaskBoard: false } });
    assert.equal(canReadCachedContentFile(db, 'site', 'beam'), true);
    raw.exec('UPDATE tasks SET assigned_to_me=0');
    assert.equal(canReadCachedContentFile(db, 'site', 'beam'), false);
    authorize({ tasks: ['view'] }, { capabilities: { canAccessTaskBoard: true, canSeeFullTaskBoard: true } });
    assert.equal(canReadCachedContentFile(db, 'site', 'beam'), true);
    raw.exec('DELETE FROM tasks');
    assert.equal(canReadCachedContentFile(db, 'site', 'beam'), false);
  } finally { raw.close(); }
});
