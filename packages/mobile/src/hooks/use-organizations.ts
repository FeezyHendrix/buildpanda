import { useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationsApi } from "@/api/organizations";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { organizationKeys, projectKeys } from "./query-keys";

export function useOrganizations() {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: organizationKeys.list(),
    ownerId: storageOwnerId,
    queryFn: organizationsApi.list,
  });
}

export function useSetActiveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: organizationsApi.setActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
