import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import type { DiscoveryAskState, DiscoveryInput, DiscoveryResponseRow } from "./types.ts";

const TABLE = "product_discovery_responses";

export function productDiscoveryRepository(db: Knex) {
  return {
    async askState(userId: string): Promise<DiscoveryAskState | undefined> {
      const row = await db("user as u")
        .leftJoin(`${TABLE} as r`, "r.user_id", "u.id")
        .where("u.id", userId)
        .first("u.createdAt as createdAt", "r.id as responseId");
      return row ? { createdAt: new Date(row.createdAt), answered: row.responseId !== null } : undefined;
    },

    // Only the answers present in `input` are written, so a later save never wipes an earlier one.
    async upsert(userId: string, input: DiscoveryInput): Promise<void> {
      const now = new Date();
      const patch: Record<string, unknown> = { updated_at: now };
      if (input.useCases) patch.use_cases = JSON.stringify(input.useCases);
      if (input.referralSources) patch.referral_sources = JSON.stringify(input.referralSources);
      if (input.currentTools) patch.current_tools = JSON.stringify(input.currentTools);
      if (input.role) patch.role = input.role;
      if (input.teamSize) patch.team_size = input.teamSize;
      if (input.activeProjects) patch.active_projects = input.activeProjects;
      if (input.completed) patch.completed_at = now;
      if (input.demoBooked) patch.demo_booked_at = now;
      await db(TABLE)
        .insert({ id: generateId("pdr"), user_id: userId, ...patch })
        .onConflict("user_id")
        .merge(patch);
    },

    // shortcut: loads every response into memory, fine for thousands; count in SQL beyond that.
    listWithUsers(): Promise<DiscoveryResponseRow[]> {
      return db(`${TABLE} as r`)
        .join("user as u", "u.id", "r.user_id")
        .orderBy("r.created_at", "desc")
        .select(
          "r.user_id",
          "u.name",
          "u.email",
          "u.createdAt as signed_up_at",
          "r.use_cases",
          "r.referral_sources",
          "r.current_tools",
          "r.role",
          "r.team_size",
          "r.active_projects",
          "r.completed_at",
          "r.demo_booked_at",
          "r.created_at",
        );
    },

    async signupsSince(from: Date): Promise<number> {
      const row = await db("user").where("createdAt", ">=", from).count<{ count: string }[]>("id as count").first();
      return Number(row?.count ?? 0);
    },
  };
}

export type ProductDiscoveryRepository = ReturnType<typeof productDiscoveryRepository>;
