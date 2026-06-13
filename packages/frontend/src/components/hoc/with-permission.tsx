import type { ComponentType } from "react";
import { useAbility } from "@/contexts/ability-context";
import type { Action, Resource } from "@/lib/ability";

/**
 * HOC that renders Component only when the current user has the given permission.
 * Renders Fallback (or null) otherwise.
 *
 * @example
 * const ProtectedButton = withPermission(CreateButton, "proposals", "create");
 *
 * const ProtectedPage = withPermission(
 *   AdminSettings,
 *   "leads",
 *   "delete",
 *   () => <p>You don't have access to this.</p>,
 * );
 */
export function withPermission<P extends object>(
  Component: ComponentType<P>,
  resource: Resource,
  action: Action,
  Fallback?: ComponentType,
): ComponentType<P> {
  function PermissionGated(props: P) {
    const ability = useAbility();
    if (ability.cannot(action, resource)) {
      return Fallback ? <Fallback /> : null;
    }
    return <Component {...props} />;
  }

  PermissionGated.displayName = `withPermission(${Component.displayName ?? Component.name})`;

  return PermissionGated;
}
