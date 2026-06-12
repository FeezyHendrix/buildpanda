import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgProfileApi, type UpdateOrgProfileInput } from "@/api/org-profile";
import { orgProfileKeys } from "./query-keys";

export function useOrgProfile() {
  return useQuery({
    queryKey: orgProfileKeys.detail(),
    queryFn: () => orgProfileApi.get(),
  });
}

export function useUpdateOrgProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrgProfileInput) => orgProfileApi.patch(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgProfileKeys.all });
    },
  });
}
