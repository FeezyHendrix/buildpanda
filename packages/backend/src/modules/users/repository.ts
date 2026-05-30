import type { Knex } from "knex";
import type { UserRow } from "./types.ts";

const SELECT_COLUMNS = ["id", "name", "email", "createdAt", "updatedAt"] as const;

export function usersRepository(db: Knex) {
  return {
    list(): Promise<UserRow[]> {
      return db<UserRow>("user").select(...SELECT_COLUMNS).orderBy("createdAt", "desc");
    },
    findById(id: string): Promise<UserRow | undefined> {
      return db<UserRow>("user").where({ id }).select(...SELECT_COLUMNS).first();
    },
    delete(id: string): Promise<number> {
      return db("user").where({ id }).del();
    },
  };
}

export type UsersRepository = ReturnType<typeof usersRepository>;
