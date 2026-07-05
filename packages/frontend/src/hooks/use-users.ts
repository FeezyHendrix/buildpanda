import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/api/users";
import type { User } from "@/api/users";

export type { User };

export const userKeys = {
  all: ["users"] as const,
  detail: (id: string) => ["users", id] as const,
  me: ["users", "me"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: userKeys.me,
    queryFn: () => usersApi.me(),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: () => usersApi.list(),
  });
}
