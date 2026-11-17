import type { AuthorizationRequest } from "../../lib/authorization-request.ts";
import { ForbiddenError } from "../../lib/errors.ts";

/** Crew may record arrivals; logging consumption requires management permission. */
export function materialLogPermissionActions(entryType: "IN" | "USED"): readonly ("request" | "manage")[] {
  return entryType === "IN" ? ["request", "manage"] : ["manage"];
}

export async function requireMaterialLogPermission(
  request: Pick<AuthorizationRequest, "requireProjectPermission">,
  projectId: string,
  entryType: "IN" | "USED",
) {
  for (const action of materialLogPermissionActions(entryType)) {
    try { return await request.requireProjectPermission(projectId, "materials", action); }
    catch (error) { if (!(error instanceof ForbiddenError)) throw error; }
  }
  throw new ForbiddenError("Your role does not allow this material movement");
}
