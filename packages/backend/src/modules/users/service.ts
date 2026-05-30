import { NotFoundError } from "../../lib/errors.ts";
import type { UsersRepository } from "./repository.ts";
import type { UserRow, UserSummary } from "./types.ts";

function toSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function usersService(repository: UsersRepository) {
  return {
    async list(): Promise<UserSummary[]> {
      const rows = await repository.list();
      return rows.map(toSummary);
    },

    async getById(id: string): Promise<UserSummary> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("User");
      return toSummary(row);
    },

    async delete(id: string): Promise<void> {
      const deleted = await repository.delete(id);
      if (!deleted) throw new NotFoundError("User");
    },
  };
}

export type UsersService = ReturnType<typeof usersService>;
