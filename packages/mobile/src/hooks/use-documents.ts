import { documentsApi } from "@/api/documents";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { documentKeys } from "./query-keys";

export function useDocuments(projectId: string | undefined) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: documentKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => documentsApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}
