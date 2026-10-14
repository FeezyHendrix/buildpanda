import type { Knex } from 'knex';
import { referencedFileIds } from '@buildpanda/rich-content';
import { assertCanAccessProject, assertProjectPermission, type EnrichedAccessContext } from '../../lib/authorization.ts';
import type { AuthorizationRequest } from '../../lib/authorization-request.ts';
import { NotFoundError } from '../../lib/errors.ts';
import { projectsRepository } from '../projects/repository.ts';
import { requireProjectFileReferences } from './attachment-access.ts';
import { filesRepository } from './repository.ts';
import { fileAccessRepository } from './access-repository.ts';

/** Tools cannot turn a guessed private file ID into a readable narrative image. */
export async function requireToolFileReferences(db: Knex, projectId: string, context: EnrichedAccessContext, body: unknown) {
  if (!referencedFileIds(body).length) return;
  const projects = projectsRepository(db);
  const request: AuthorizationRequest & { body: unknown } = {
    ...context, body, activeOrganizationId: null,
    requireAuth: () => ({ id: context.userId }),
    async requireProjectAccess(id) {
      const row = await projects.findById(id);
      if (!row) throw new NotFoundError('Project');
      assertCanAccessProject({ id: row.id, ownerId: row.owner_id, organizationId: row.organization_id }, context);
      return row;
    },
    async requireProjectPermission(id, resource, action) {
      const row = await this.requireProjectAccess(id);
      assertProjectPermission({ id: row.id, ownerId: row.owner_id, organizationId: row.organization_id }, context, resource, action);
      return row;
    },
  };
  // A direct conversation still needs the selected workspace for its own guard.
  const project = await request.requireProjectAccess(projectId);
  request.activeOrganizationId = project.organization_id;
  await requireProjectFileReferences(request, projectId, filesRepository(db), fileAccessRepository(db));
}
