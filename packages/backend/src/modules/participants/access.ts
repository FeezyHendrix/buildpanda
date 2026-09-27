import type { FastifyRequest } from "fastify";
import { effectiveParticipantGrants, participantRole } from "../../lib/authorization.ts";
import { statement } from "../../lib/permissions.ts";
import type { ParticipantRole } from "./types.ts";

/**
 * What this caller is to this project and what the UI may therefore show. The
 * permission map here mirrors `assertProjectPermission` exactly — a surface the
 * API would refuse must not render, and one it allows must not be hidden.
 */
export function computeAccess(
  project: { id: string; owner_id: string | null; organization_id: string | null },
  request: FastifyRequest,
) {
  const ctx = {
    userId: request.user!.id,
    orgRoles: request.orgRoles,
    projectRoles: request.projectRoles,
    projectSectionPermissions: request.projectSectionPermissions,
    projectGrants: request.projectGrants,
  };
  const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
  const orgRole = project.organization_id ? request.orgRoles.get(project.organization_id) : undefined;
  const pRole = participantRole(scope, ctx);
  const sections = request.projectSectionPermissions.get(project.id);

  let relationship: "company" | ParticipantRole | "none" = "none";
  if (orgRole) relationship = "company";
  else if (pRole) relationship = pRole as ParticipantRole;
  else if (project.owner_id === request.user!.id) relationship = "company";

  const isCompanyManager = relationship === "company" && orgRole !== "viewer";
  const isClient = relationship === "client";

  // Effective resource permissions — the same inputs assertProjectPermission
  // composes, exposed so the UI can hide surfaces the caller cannot view.
  const permissions: Record<string, string[]> = {};
  if (project.owner_id === request.user!.id) {
    // Personal project owners have full access (mirrors assertProjectPermission).
    for (const [res, actions] of Object.entries(statement)) {
      permissions[res] = [...actions];
    }
  } else {
    const orgPerms = project.organization_id
      ? request.orgPermissions.get(project.organization_id)
      : undefined;
    if (orgPerms) {
      for (const [res, actions] of orgPerms) permissions[res] = [...actions];
    }
    // Participant overlay (stored grants when present, else legacy compose) —
    // must mirror assertProjectPermission so the UI shows exactly what the API allows.
    for (const [res, actions] of Object.entries(effectiveParticipantGrants(scope, ctx))) {
      permissions[res] = [...new Set([...(permissions[res] ?? []), ...actions])];
    }
  }

  // Capabilities honor the composed permissions above (participant-role
  // defaults + per-participant matrix), not just company/client status —
  // otherwise a participant granted e.g. approvals:decide via the matrix
  // would be authorized by the backend but see a read-only UI.
  const allows = (resource: string, action: string): boolean =>
    (permissions[resource] ?? []).includes(action);

  return {
    relationship,
    orgRole: orgRole ?? null,
    permissions,
    sections: sections ?? null,
    capabilities: {
      canManage: isCompanyManager,
      canViewAll: relationship !== "none",
      canManageParticipants: isCompanyManager || allows("participants", "manage"),
      canDecideApprovals: isCompanyManager || isClient || allows("approvals", "decide"),
      canDecideSelections: isCompanyManager || isClient || allows("selections", "decide"),
      // The cost position is the contractor's own; a client-side participant
      // sees the contract they are party to and never the costs behind it.
      canViewCosts: isCompanyManager || allows("finances", "viewCosts"),
      canComment:
        (relationship !== "none" && relationship !== "guest") || allows("comments", "post"),
    },
  };
}
