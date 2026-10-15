import type { EnrichedAccessContext } from './authorization.ts';
import type { ProjectRow } from '../modules/projects/types.ts';

export type AuthorizedProject = Pick<ProjectRow, 'id' | 'owner_id' | 'organization_id'>;

/** Domain guards consume this capability interface, from HTTP or an AI executor. */
export interface AuthorizationRequest extends Omit<EnrichedAccessContext, 'userId'> {
  activeOrganizationId?: string | null;
  requireAuth(): { id: string };
  requireProjectAccess(id: string): Promise<AuthorizedProject>;
  requireProjectPermission(id: string, resource: string, action: string): Promise<AuthorizedProject>;
}
