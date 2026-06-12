import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadsApi, type LeadStatus } from "@/api/leads";
import { leadKeys } from "./query-keys";

export function useLeads(filters?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: leadKeys.list({ status: filters?.status }),
    queryFn: () => leadsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: LeadStatus; notes?: string }) =>
      leadsApi.patch(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}
