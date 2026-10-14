import assert from 'node:assert/strict';
import { test } from 'node:test';
import knex from 'knex';
import type { FastifyRequest } from 'fastify';
import { imageHtml, appendImage, contentParts, htmlFromText, plainTextFromHtml } from '@buildpanda/rich-content';
import { sanitizeHtmlFields, sanitizeRichText } from '../../lib/rich-text.ts';
import { assertProjectPermission, type EnrichedAccessContext } from '../../lib/authorization.ts';
import { ForbiddenError } from '../../lib/errors.ts';
import { fileAccessRepository } from './access-repository.ts';
import { requireFileRead } from './access.ts';
import type { UploadedFileRow } from './types.ts';
import { toolsForCaller } from '../panda-ai/agent/tool-permissions.ts';
import { tool, fn } from '../panda-ai/agent/tool-helpers.ts';
import type { ToolContext } from '../panda-ai/agent/tools.ts';
import Fastify from 'fastify';
import publicProposalRoutes from '../proposals/public-routes.ts';

test('rich and plain narrative images retain stable references and reject executable or remote HTML', () => {
  const image = { fileId: 'site_photo-1', name: 'Beam <detail> "A"' };
  const html = imageHtml(image);
  const clean = sanitizeRichText(`<p>Before</p>${html}<p>After</p><img src="https://tracker.invalid/a"><img src="data:image/svg+xml,evil"><script>alert(1)</script>`);
  assert.match(clean, /data-file-id="site_photo-1"/);
  assert.match(clean, /src="\/files\/site_photo-1\/download"/);
  assert.doesNotMatch(clean, /tracker|data:image|script|alert/);
  assert.equal(plainTextFromHtml(html), '[Image: Beam <detail> "A"]');
  const text = appendImage('Line one\nLine two', image);
  assert.equal(contentParts(text).filter((part) => part.type === 'image').length, 1);
  assert.match(sanitizeRichText(htmlFromText(text)), /data-file-id="site_photo-1"/);
  const nested = sanitizeHtmlFields({ answers: [{ notesHtml: '<img data-file-id="safe" onerror="alert(1)" src="javascript:alert(1)">' }] });
  assert.deepEqual(nested, { answers: [{ notesHtml: '<img data-file-id="safe" src="/files/safe/download" alt="Image" />' }] });
});

const databaseUrl = process.env.IMAGE_TEST_DATABASE_URL;
test('persisted narrative references enforce resource, RFI visibility, assignment, override and organization scopes', { skip: !databaseUrl }, async () => {
  const db = knex({ client: 'pg', connection: databaseUrl });
  const tx = await db.transaction();
  try {
    await tx('user').insert(['crew', 'owner'].map((id) => ({ id: `image-${id}`, name: id, email: `${id}@images.invalid` })));
    await tx('organization').insert({ id: 'image-org', name: 'Image fixture', slug: 'image-fixture' });
    const project = { id: 'image-site', ownerId: 'image-owner', organizationId: 'image-org' };
    const projectRow = { id: project.id, owner_id: project.ownerId, organization_id: project.organizationId };
    await tx('projects').insert({ ...projectRow, name: 'Site', address: 'Fixture', status: 'On Track', risk: 'Low', currency: 'NGN' });
    await tx('buildings').insert({ id: 'image-building', project_id: project.id, name: 'Block' });
    await tx('task_boards').insert({ id: 'image-board', project_id: project.id, building_id: 'image-building' });
    await tx('task_columns').insert({ id: 'image-column', board_id: 'image-board', name: 'To do', status: 'Todo' });
    const picture = (id: string) => imageHtml({ fileId: id, name: 'Evidence' });
    await tx('tasks').insert({ id: 'image-task', project_id: project.id, building_id: 'image-building', board_id: 'image-board', column_id: 'image-column', title: 'Check', description_html: picture('task-file') });
    await tx('task_assignees').insert({ task_id: 'image-task', assignee_id: 'image-crew' });
    await tx('rfis').insert(['shared', 'internal'].map((visibility, i) => ({ id: `image-rfi-${visibility}`, project_id: project.id, number: i + 1, subject: 'Check', question: 'Question', question_html: picture(`${visibility}-file`), visibility })));
    await tx('rfi_comments').insert({ id: 'image-proposed', author_id: 'image-crew', rfi_id: 'image-rfi-shared', body: 'Proposal', author_name: 'Crew', content_html: picture('proposed-file'), is_proposed_response: true });
    await tx('project_finances').insert({ project_id: project.id, currency: 'NGN', contract_notes: appendImage('Terms', { fileId: 'terms-file', name: 'Terms' }) });
    await tx('proposal_templates').insert({ id: 'image-template', org_id: 'image-org', name: 'Template', pack_sections: JSON.stringify([{ bodyHtml: picture('template-file') }]) });
    await tx('uploaded_files').insert(['shared-file', 'internal-file'].map((id) => ({ id, owner_id: project.ownerId, project_id: project.id, file_name: 'Evidence.png', mime_type: 'image/png', size_bytes: 100, storage_path: `fixture/${id}` })));
    const repository = fileAccessRepository(tx);
    let ctx: EnrichedAccessContext = { userId: 'image-crew', orgRoles: new Map(), orgPermissions: new Map(), projectRoles: new Map([[project.id, 'client']]), projectGrants: new Map([[project.id, { rfis: ['view'] }]]), projectSectionPermissions: new Map() };
    const request = () => ({ ...ctx, requireAuth: () => ({ id: ctx.userId }), requireProjectAccess: async () => projectRow,
      requireProjectPermission: async (id: string, resource: string, action: string) => { assertProjectPermission({ ...project, id }, ctx, resource, action); return projectRow; },
    }) as unknown as FastifyRequest;
    const read = (id: string, projectId: string | null = project.id) => requireFileRead(request(), { id, project_id: projectId, owner_id: 'image-owner' } as UploadedFileRow, repository);
    await read('shared-file');
    await assert.rejects(read('internal-file'), ForbiddenError);
    await assert.rejects(read('proposed-file'), ForbiddenError);
    await assert.rejects(read('terms-file'), ForbiddenError);
    await assert.rejects(read('shared-file', 'foreign'), ForbiddenError);
    // Exercise the actual AI execution wrapper, before its business handler.
    ctx.projectGrants.set(project.id, { rfis: ['view', 'create'] });
    const toolContext: ToolContext = { db: tx, projectId: project.id, caller: { ...ctx, user: { id: ctx.userId, name: 'Crew' }, project } };
    let executions = 0;
    const [guarded] = toolsForCaller([tool(fn('create_rfi', 'Create an RFI'), async () => { executions++; return { output: { ok: true } }; })], toolContext);
    assert(guarded);
    await guarded.run(toolContext, { questionHtml: picture('shared-file') });
    await assert.rejects(guarded.run(toolContext, { questionHtml: picture('internal-file') }), ForbiddenError);
    assert.equal(executions, 1, 'a denied file never reaches the write handler');
    ctx.orgRoles = new Map([['image-org', 'employee']]);
    ctx.orgPermissions = new Map([['image-org', new Map([['tasks', new Set(['view'])], ['rfis', new Set(['view'])]])]]);
    ctx.projectGrants = new Map(); ctx.projectRoles = new Map();
    await read('task-file'); await read('internal-file'); await read('proposed-file');
    await tx('task_assignees').where({ task_id: 'image-task' }).delete();
    await assert.rejects(read('task-file'), ForbiddenError);
    ctx.orgPermissions = new Map([['image-org', new Map([['proposals', new Set(['view'])]])]]);
    await read('template-file', null);
    ctx.orgPermissions = new Map();
    await assert.rejects(read('template-file', null), ForbiddenError);
    ctx.orgRoles = new Map(); ctx.projectRoles = new Map([[project.id, 'client']]);
    ctx.projectGrants = new Map([[project.id, {}]]);
    await assert.rejects(read('shared-file'), ForbiddenError);
    // Running the full catalog also verifies all joins against current migrations.
    assert.deepEqual(await repository.projectReferences('missing'), []);
    assert.deepEqual(await repository.organizationReferences('missing'), []);
  } finally { await tx.rollback(); await db.destroy(); }
});

test('public proposal image links are restricted to the visible offer and expire with its token', { skip: !databaseUrl }, async () => {
  const db = knex({ client: 'pg', connection: databaseUrl });
  const tx = await db.transaction();
  const app = Fastify();
  try {
    app.decorate('db', tx);
    await app.register(publicProposalRoutes);
    await tx('user').insert({ id: 'public-images-owner', name: 'Owner', email: 'public@images.invalid' });
    await tx('organization').insert({ id: 'public-images-org', name: 'Contractor', slug: 'public-images' });
    await tx('proposals').insert({ id: 'public-images-proposal', org_id: 'public-images-org', number: 1, title: 'Offer', client_name: 'Client', currency: 'NGN', created_by: 'public-images-owner' });
    await tx('estimates').insert({ id: 'public-images-estimate', proposal_id: 'public-images-proposal', revision_no: 1, status: 'Sent', share_token: 'image-offer-token' });
    await tx('proposal_pack_sections').insert([
      { id: 'visible-section', proposal_id: 'public-images-proposal', kind: 'scope', body_html: imageHtml({ fileId: 'public-picture', name: 'Scope' }), sort: 0, origin: 'manual' },
      { id: 'private-section', proposal_id: 'public-images-proposal', kind: 'site_survey', body_html: imageHtml({ fileId: 'private-picture', name: 'Private' }), sort: 1, origin: 'manual' },
    ]);
    const visible = await app.inject('/proposals/public/image-offer-token');
    assert.equal(visible.statusCode, 200, visible.body);
    assert.match(visible.body, /public-picture/);
    assert.doesNotMatch(visible.body, /private-picture/);
    await tx('uploaded_files').insert({ id: 'public-picture', owner_id: 'public-images-owner', file_name: 'Scope.png', mime_type: 'image/png', size_bytes: 100, storage_path: 'fixture/scope.png' });
    const allowed = await app.inject('/proposals/public/image-offer-token/files/public-picture');
    assert.equal(allowed.statusCode, 200, allowed.body);
    assert.match(allowed.json().url, /fixture\/scope.png/);
    // File absence is still a 404; neither a guessed ID nor an internal section is a capability.
    for (const id of ['private-picture', 'guessed-picture']) {
      const denied = await app.inject(`/proposals/public/image-offer-token/files/${id}`);
      assert.equal(denied.statusCode, 404, denied.body);
    }
    const response = await app.inject({ method: 'POST', url: '/proposals/public/image-offer-token/respond', payload: { action: 'change_requested', message: appendImage('Read this', { fileId: 'private-picture', name: 'Secret' }) } });
    assert.equal(response.statusCode, 404, response.body);
    await tx('estimates').where({ id: 'public-images-estimate' }).update({ share_token_expires_at: new Date(0) });
    assert.equal((await app.inject('/proposals/public/image-offer-token/files/public-picture')).statusCode, 404);
  } finally { await app.close(); await tx.rollback(); await db.destroy(); }
});
