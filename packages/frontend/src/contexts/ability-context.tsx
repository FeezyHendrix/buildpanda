import { createContext, useContext, useMemo, type ReactNode } from "react";
import { buildAbility, type Ability } from "@/lib/ability";
import { useMyOrgRole } from "@/hooks/use-organization";

const AbilityContext = createContext<Ability>(buildAbility(null));

/**
 * Provides the current user's org-role ability to the component tree.
 * Place this once in the layout (e.g. SalesLayout) — all descendants
 * access permissions via useAbility() without re-fetching.
 */
export function AbilityProvider({ children }: { children: ReactNode }) {
  const role = useMyOrgRole();
  const ability = useMemo(() => buildAbility(role), [role]);
  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}

/** Returns the current user's Ability. Must be used inside AbilityProvider. */
export function useAbility(): Ability {
  return useContext(AbilityContext);
}
