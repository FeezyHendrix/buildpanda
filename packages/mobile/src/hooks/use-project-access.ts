import { useCallback } from "react";
import { participantsApi } from "@/api/participants";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { participantKeys } from "./query-keys";

/**
 * What the signed-in user may do on the current project, cached so the tools
 * still show the right actions with no signal. Until the first answer arrives
 * everything is allowed, as on the web: the server still has the final say.
 */
export function useProjectAccess() {
  const { projectId, storageOwnerId } = useFieldSession();
  const query = usePersistentQuery({
    queryKey: participantKeys.access(projectId),
    ownerId: storageOwnerId,
    queryFn: () => participantsApi.access(projectId!),
    enabled: Boolean(projectId),
  });
  const permissions = query.data?.permissions;

  const can = useCallback(
    (resource: string, action: string) => {
      if (!permissions) return true;
      const actions = permissions[resource] ?? [];
      return actions.includes(action) || actions.includes("manage");
    },
    [permissions],
  );
  return { can, isKnown: permissions !== undefined };
}
