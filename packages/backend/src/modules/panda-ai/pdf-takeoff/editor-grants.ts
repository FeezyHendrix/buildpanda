// Resolving a caller's org permissions into the grants the envelope checks.
//
// Shared because what an operation needs depends on the command inside it, so
// the route cannot decide it alone: an ordinary edit needs `edit`, bringing a new
// measurement into being also needs `measure`, signing off also needs `verify`.

import type { FastifyRequest } from "fastify";
import { mapAllows } from "../../../lib/permissions.ts";
import type { EditorGrants } from "./editor-operation-types.ts";

export function grantsOf(request: FastifyRequest, orgId: string): EditorGrants {
  const perms = request.orgPermissions?.get(orgId);
  const allows = (action: string): boolean => (perms ? mapAllows(perms, "takeoffs", action) : false);
  return { edit: allows("edit"), measure: allows("measure"), verify: allows("verify") };
}
