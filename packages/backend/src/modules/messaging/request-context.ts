import type { FastifyRequest } from "fastify";
import type { ReferenceContext } from "./references.ts";

export function referenceContext(request: FastifyRequest): ReferenceContext {
  return {
    userId: request.user?.id ?? "",
    orgRoles: request.orgRoles,
    projectRoles: request.projectRoles,
    orgPermissions: request.orgPermissions,
    projectSectionPermissions: request.projectSectionPermissions,
    projectGrants: request.projectGrants,
  };
  }
