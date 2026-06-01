import type { Knex } from "knex";
import type { TeamMemberRow, TeamMemberStatus } from "./types.ts";

export interface NewTeamMemberRecord {
  id: string;
  project_id: string;
  name: string;
  role: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  responsibilities: string | null;
  status: TeamMemberStatus;
}

export interface TeamMemberUpdatePatch {
  name?: string;
  role?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  responsibilities?: string | null;
  status?: TeamMemberStatus;
}

export function teamMembersRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<TeamMemberRow[]> {
      return db<TeamMemberRow>("team_members")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<TeamMemberRow | undefined> {
      return db<TeamMemberRow>("team_members").where({ id }).first();
    },

    async create(record: NewTeamMemberRecord): Promise<TeamMemberRow> {
      const [row] = await db<TeamMemberRow>("team_members")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert team member");
      return row;
    },

    async update(
      id: string,
      patch: TeamMemberUpdatePatch,
    ): Promise<TeamMemberRow | undefined> {
      const [row] = await db<TeamMemberRow>("team_members")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    async deleteTeamMember(id: string): Promise<void> {
      await db("team_members").where({ id }).delete();
    },
  };
}

export type TeamMembersRepository = ReturnType<typeof teamMembersRepository>;
