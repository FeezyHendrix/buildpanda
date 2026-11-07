import type { FastifyRequest } from "fastify";

/** Company-side callers see every RFI; everyone else sees only `shared` ones. */
export function isCompanyCaller(
  request: FastifyRequest,
  project: { owner_id: string | null; organization_id: string | null },
): boolean {
  const user = request.requireAuth();
  if (project.owner_id === user.id) return true;
  return Boolean(project.organization_id && request.orgRoles.has(project.organization_id));
}
