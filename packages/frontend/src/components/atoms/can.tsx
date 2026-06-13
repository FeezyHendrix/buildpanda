import type { ReactNode } from "react";
import { useAbility } from "@/contexts/ability-context";
import type { Action, Resource } from "@/lib/ability";

interface CanProps {
  /** The action to check (e.g. "create", "send"). */
  do: Action;
  /** The resource to check against (e.g. "proposals", "leads"). */
  on: Resource;
  children: ReactNode;
  /** Rendered when the user lacks permission. Defaults to null. */
  fallback?: ReactNode;
}

/**
 * Declaratively gates UI based on the current user's ability.
 *
 * @example
 * <Can do="create" on="proposals">
 *   <Button>New proposal</Button>
 * </Can>
 *
 * <Can do="convert" on="proposals" fallback={<p>Insufficient permissions.</p>}>
 *   <Button>Convert to project</Button>
 * </Can>
 */
export function Can({ do: action, on: resource, children, fallback = null }: CanProps) {
  const ability = useAbility();
  return ability.can(action, resource) ? <>{children}</> : <>{fallback}</>;
}
