import { useMemo } from "react";
import { participantsApi, toAssignees, type CommentAssignee } from "@/api/participants";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { participantKeys } from "./query-keys";

/**
 * Active project members with a real account — the only people who can be named
 * as a reviewer or tagged on a comment.
 */
export function useProjectAssignees(projectId: string | undefined): CommentAssignee[] {
  const { storageOwnerId } = useFieldSession();
  const query = usePersistentQuery({
    queryKey: participantKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => participantsApi.list(projectId!),
    enabled: Boolean(projectId),
  });

  return useMemo(() => toAssignees(query.data ?? []), [query.data]);
}
