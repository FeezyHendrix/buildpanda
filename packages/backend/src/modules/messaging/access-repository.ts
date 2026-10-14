import type { ChannelRow } from "./types.ts";
import type { ProjectRow } from "../projects/types.ts";
import type { Knex } from "knex";

export function messagingAccessRepository(db: Knex) {
  return {
    memberChannel: async (channelId: string, userId: string) => db<ChannelRow>("channels as c")
      .join("channel_members as m", "m.channel_id", "c.id").where({ "c.id": channelId, "m.user_id": userId }).select("c.*").first(),
    projectScope: async (id: string) => db<ProjectRow>("projects").where({ id }).first(),
    workspaceMember: (userId: string, organizationId: string) => db("member").where({ userId, organizationId }).first("id"),
    accessibleProjectIds: (userId: string, orgIds: string[], participantProjectIds: string[]) => db("projects")
      .where(function () {
        this.where("owner_id", userId);
        if (orgIds.length) this.orWhereIn("organization_id", orgIds);
        if (participantProjectIds.length) this.orWhereIn("id", participantProjectIds);
      }).pluck<string[]>("id"),
  };
}
