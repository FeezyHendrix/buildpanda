import { keyDatesApi } from "@/api/key-dates";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { keyDateKeys } from "./query-keys";

export function useKeyDates(projectId: string | undefined, enabled = true) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: keyDateKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => keyDatesApi.list(projectId!),
    enabled: enabled && Boolean(projectId),
  });
}
