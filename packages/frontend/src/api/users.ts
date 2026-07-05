import api from "./client";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  me: () => api.get<User>("/users/me").then((r) => r.data),
  list: () => api.get<User[]>("/users").then((r) => r.data),
};
