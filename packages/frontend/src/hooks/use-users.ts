import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

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
