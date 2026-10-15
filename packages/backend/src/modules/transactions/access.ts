import { canSeeAllExpenses } from "../../lib/authorization.ts";
import { requestAccessContext, type AuthorizationRequest, type AuthorizedProject } from "../../lib/authorization-request.ts";

/** Undefined is deliberately reserved for callers with the explicit full-ledger grant. */
export function expenseReaderId(request: AuthorizationRequest, project: AuthorizedProject): string | undefined {
  const context = requestAccessContext(request);
  return canSeeAllExpenses({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, context) ? undefined : context.userId;
}
