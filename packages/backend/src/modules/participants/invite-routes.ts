import type { Knex } from "knex";
import type { FastifyPluginAsync } from "fastify";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import type { ParticipantRow } from "./types.ts";

const tokenParams = {
  type: "object",
  required: ["token"],
  additionalProperties: false,
  properties: { token: { type: "string", minLength: 1 } },
} as const;

const PROJECT_CARD_COLUMNS = [
  "id",
  "name",
  "address",
  "status",
  "health_score",
  "risk",
  "progress_percent",
  "budget_total",
  "budget_used",
  "currency",
  "folder_tone",
  "updated_at",
] as const;

/** Accepting an invite and listing the projects the caller can see. */
const participantInviteRoutes: FastifyPluginAsync = async (fastify) => {
  const db: Knex = fastify.db;

  // --- Invite preview + accept ---
  fastify.get<{ Params: { token: string } }>(
    "/project-invites/:token",
    { schema: { params: tokenParams } },
    async (request) => {
      const invite = await db<ParticipantRow>("project_participants")
        .where({ invite_token: request.params.token, status: "invited" })
        .first();
      if (!invite) throw new NotFoundError("Invitation");
      const project = await db("projects").where({ id: invite.project_id }).first();
      const inviter = invite.invited_by_id
        ? await db("user").where({ id: invite.invited_by_id }).first<{ name: string }>()
        : null;
      return {
        email: invite.email,
        role: invite.role,
        projectName: (project as { name?: string } | undefined)?.name ?? "a project",
        inviterName: inviter?.name ?? null,
        expired: invite.invite_expires_at ? new Date(invite.invite_expires_at) < new Date() : false,
      };
    },
  );

  fastify.post<{ Params: { token: string } }>(
    "/project-invites/:token/accept",
    { schema: { params: tokenParams } },
    async (request) => {
      const user = request.requireAuth();
      const invite = await db<ParticipantRow>("project_participants")
        .where({ invite_token: request.params.token, status: "invited" })
        .first();
      if (!invite) throw new NotFoundError("Invitation");
      if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
        throw new BadRequestError("This invitation has expired.");
      }
      if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
        throw new BadRequestError("This invitation was sent to a different email address.");
      }
      // The partial unique index on (project_id, user_id) means a prior (even
      // revoked) row already holding this user blocks setting user_id on the new
      // invite row. Merge the new invite's role into that existing row and drop
      // the redundant invite, so re-invites and role changes accept cleanly.
      const now = new Date().toISOString();
      await db.transaction(async (trx) => {
        const linked = await trx<ParticipantRow>("project_participants")
          .where({ project_id: invite.project_id, user_id: user.id })
          .first();
        if (linked && linked.id !== invite.id) {
          await trx("project_participants").where({ id: linked.id }).update({
            role: invite.role,
            permissions: JSON.stringify(invite.permissions ?? {}),
            status: "active",
            invite_token: null,
            updated_at: now,
          });
          await trx("project_participants").where({ id: invite.id }).delete();
        } else {
          await trx("project_participants").where({ id: invite.id }).update({
            user_id: user.id,
            status: "active",
            invite_token: null,
            updated_at: now,
          });
        }
      });
      await fastify.accessCache.invalidate(user.id);
      return { projectId: invite.project_id, role: invite.role };
    },
  );

  // --- Client/company dashboard: projects I can see ---
  fastify.get("/me/projects", async (request) => {
    const user = request.requireAuth();
    const orgIds = [...request.orgRoles.keys()];
    const participantProjectIds = await db("project_participants")
      .where({ user_id: user.id })
      .whereNot("status", "revoked")
      .pluck("project_id");
    const rows = await db("projects")
      .where(function () {
        this.where("owner_id", user.id);
        if (orgIds.length) this.orWhereIn("organization_id", orgIds);
        if (participantProjectIds.length) this.orWhereIn("id", participantProjectIds);
      })
      .select(...PROJECT_CARD_COLUMNS)
      .orderBy("updated_at", "desc");
    return rows;
  });
};

export default participantInviteRoutes;
