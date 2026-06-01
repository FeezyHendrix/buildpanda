import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { TeamMembersRepository } from "./repository.ts";
import type { TeamMember, TeamMemberRow, TeamMemberStatus } from "./types.ts";

export interface CreateTeamMemberInput {
  name: string;
  role: string;
  company?: string;
  email?: string;
  phone?: string;
  responsibilities?: string;
  status?: TeamMemberStatus;
}

export interface EditTeamMemberInput {
  name?: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  responsibilities?: string;
  status?: TeamMemberStatus;
}

function toTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    company: row.company,
    email: row.email,
    phone: row.phone,
    responsibilities: row.responsibilities,
    status: row.status,
  };
}

function optional(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function teamMembersService(repository: TeamMembersRepository) {
  return {
    async listByProject(projectId: string): Promise<TeamMember[]> {
      const rows = await repository.listByProject(projectId);
      return rows.map(toTeamMember);
    },

    async create(
      projectId: string,
      input: CreateTeamMemberInput,
    ): Promise<TeamMember> {
      const row = await repository.create({
        id: generateId("team"),
        project_id: projectId,
        name: input.name.trim(),
        role: input.role.trim(),
        company: optional(input.company) ?? null,
        email: optional(input.email) ?? null,
        phone: optional(input.phone) ?? null,
        responsibilities: optional(input.responsibilities) ?? null,
        status: input.status ?? "Active",
      });
      return toTeamMember(row);
    },

    async edit(
      projectId: string,
      memberId: string,
      input: EditTeamMemberInput,
    ): Promise<TeamMember> {
      const existing = await repository.findById(memberId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Team member");
      }

      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.role !== undefined) patch.role = input.role.trim();
      if (input.company !== undefined) patch.company = optional(input.company);
      if (input.email !== undefined) patch.email = optional(input.email);
      if (input.phone !== undefined) patch.phone = optional(input.phone);
      if (input.responsibilities !== undefined) {
        patch.responsibilities = optional(input.responsibilities);
      }
      if (input.status !== undefined) patch.status = input.status;

      const updated = await repository.update(memberId, patch);
      if (!updated) throw new NotFoundError("Team member");
      return toTeamMember(updated);
    },

    async remove(projectId: string, memberId: string): Promise<void> {
      const existing = await repository.findById(memberId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Team member");
      }
      await repository.deleteTeamMember(memberId);
    },
  };
}

export type TeamMembersService = ReturnType<typeof teamMembersService>;
