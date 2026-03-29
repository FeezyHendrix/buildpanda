import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import type { User } from "@/stores/auth";

export const userKeys = {
  all: ["users"] as const,
  detail: (id: string) => ["users", id] as const,
  me: ["users", "me"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: userKeys.me,
    queryFn: async () => {
      const { data } = await api.get<User>("/users/me");
      return data;
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: async () => {
      const { data } = await api.get<User[]>("/users");
      return data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; email: string }) => {
      const { data } = await api.post<User>("/users", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
