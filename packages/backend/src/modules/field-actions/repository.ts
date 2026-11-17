import type { Knex } from "knex";
import type { DailyLogCommand, FieldActionUser } from "./types.ts";

export function fieldActionsRepository(db: Knex) {
  return {
    userById(userId: string): Promise<FieldActionUser | undefined> {
      return db<FieldActionUser>("user").where({ id: userId }).select("id", "name", "banned", "banExpires").first();
    },
    async lockDailyTarget(command: DailyLogCommand): Promise<void> {
      const key = JSON.stringify(["field-daily-log", command.projectId, command.buildingId, command.logDate]);
      await db.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [key]);
    },
  };
}
