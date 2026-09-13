import type { Knex } from "knex";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { assertCanGrant, ROLE_PRESET_SIDES, type GrantValidationContext } from "../../lib/authorization.ts";
import { ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { sendEmail } from "../../lib/mail.ts";
import { captureBug } from "../../lib/sentry.ts";
import { projectInviteEmail } from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";
import { messagingRepository } from "../messaging/repository.ts";
import { messagingService } from "../messaging/service.ts";
import { computeAccess } from "./access.ts";
import { inviteBody, participantParams, projectIdParams, updateBody } from "./schemas.ts";
import participantInviteRoutes from "./invite-routes.ts";
import {
  type InviteParticipantBody,
  type ParticipantRow,
  type ParticipantSide,
  type TeamEntry,
  type UpdateParticipantBody,
} from "./types.ts";

function toParticipant(r: ParticipantRow): TeamEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id,
    name: r.name ?? null,
    email: r.email,
    role: r.role,
    side: r.side ?? null,
    status: r.status,
    permissions: (r.permissions as Record<string, string>) ?? {},
    grants: (r.grants as Record<string, string[]> | null) ?? null,
    createdAt: r.created_at,
  };
}

/** A participant's side defaults from the starter role they were invited on. */
function sideFor(explicit: ParticipantSide | undefined, role: string): ParticipantSide | null {
  return explicit ?? ROLE_PRESET_SIDES[role] ?? null;
}

const appUrl = config.mail.appUrl;

const participantRoutes: FastifyPluginAsync = async (fastify) => {
  const db: Knex = fastify.db;
  const messaging = messagingService(messagingRepository(fastify.db));
  await fastify.register(participantInviteRoutes);

  function validateGrants(
    request: FastifyRequest,
    project: { organization_id: string | null },
    grants: Record<string, string[]> | undefined,
  ): void {
    if (!grants) return;
    const orgRole = project.organization_id
      ? request.orgRoles.get(project.organization_id)
      : undefined;
    const ctx: GrantValidationContext = {
      userId: request.user!.id,
      orgRoles: request.orgRoles,
      orgPermissions: request.orgPermissions,
      projectRoles: request.projectRoles,
      projectSectionPermissions: request.projectSectionPermissions,
      projectGrants: request.projectGrants,
      isOrgAdmin: orgRole === "owner" || orgRole === "admin",
    };
    assertCanGrant(ctx, grants);
  }

  async function resolveProjectOwner(
    ownerId: string | null,
    organizationId: string | null,
  ): Promise<{ id: string; name: string | null; email: string } | null> {
    if (ownerId) {
      const owner = await db("user")
        .where({ id: ownerId })
        .first<{ id: string; name: string | null; email: string }>("id", "name", "email");
      if (owner) return owner;
    }
    if (organizationId) {
      const orgOwner = await db("member as m")
        .join("user as u", "u.id", "m.userId")
        .where({ "m.organizationId": organizationId, "m.role": "owner" })
        .first<{ id: string; name: string | null; email: string }>(
          "u.id as id",
          "u.name as name",
          "u.email as email",
        );
      if (orgOwner) return orgOwner;
    }
    return null;
  }

  // --- Company-side participant management ---
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/participants",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "view");
      const rows = await db<ParticipantRow>("project_participants as p")
        .leftJoin("user as u", "u.id", "p.user_id")
        .where("p.project_id", project.id)
        .whereNot("p.status", "revoked")
        .select(
          "p.id",
          "p.project_id",
          "p.user_id",
          "p.email",
          "p.role",
          "p.side",
          "p.status",
          "p.permissions",
          "p.grants",
          "p.invited_by_id",
          "p.created_at",
          "p.updated_at",
          db.raw("COALESCE(p.name, u.name) as name"),
        )
        .orderBy("p.created_at", "asc");

      const participants: TeamEntry[] = rows.map(toParticipant);
      const owner = await resolveProjectOwner(project.owner_id, project.organization_id);
      if (owner && !participants.some((p) => p.userId === owner.id)) {
        participants.unshift({
          id: `owner-${owner.id}`,
          projectId: project.id,
          userId: owner.id,
          name: owner.name,
          email: owner.email,
          role: "owner",
          side: "contractor",
          status: "active",
          permissions: {},
          grants: null,
          createdAt: String(project.created_at),
        });
      }
      return participants;
    },
  );

  /**
   * Everyone work can be handed to on this project — ball-in-court on an RFI,
   * a task assignee, an inspector. People who have been INVITED but have not
   * logged in yet are included: on a real job the RE is named in the RFI the
   * day they are appointed, not the day they accept an email. `userId` is null
   * for those, so a consumer that keys assignment on a user account shows them
   * and records the participant id instead.
   */
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/participants/assignable",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "view");
      const rows = await db<ParticipantRow>("project_participants as p")
        .leftJoin("user as u", "u.id", "p.user_id")
        .where("p.project_id", project.id)
        .whereIn("p.status", ["invited", "active"])
        .select(
          "p.id",
          "p.project_id",
          "p.user_id",
          "p.email",
          "p.role",
          "p.side",
          "p.status",
          "p.permissions",
          "p.grants",
          "p.invited_by_id",
          "p.created_at",
          "p.updated_at",
          db.raw("COALESCE(p.name, u.name) as name"),
        )
        .orderBy("p.created_at", "asc");
      const owner = await resolveProjectOwner(project.owner_id, project.organization_id);
      const assignees = rows.map((row) => ({
        ...toParticipant(row),
        pending: row.status === "invited",
      }));
      if (owner && !assignees.some((a) => a.userId === owner.id)) {
        assignees.unshift({
          id: `owner-${owner.id}`,
          projectId: project.id,
          userId: owner.id,
          name: owner.name,
          email: owner.email,
          role: "owner",
          side: "contractor",
          status: "active",
          permissions: {},
          grants: null,
          createdAt: String(project.created_at),
          pending: false,
        });
      }
      return assignees;
    },
  );

  fastify.post<{ Params: { id: string }; Body: InviteParticipantBody }>(
    "/projects/:id/participants/invite",
    { schema: { params: projectIdParams, body: inviteBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "manage");
      const user = request.requireAuth();
      validateGrants(request, project, request.body.grants);

      const email = request.body.email.trim().toLowerCase();
      const role = request.body.role?.trim() || "client";

      if (email === user.email.toLowerCase()) {
        throw new ConflictError("You already have access to this project — no need to invite yourself.");
      }

      const existing = await db<ParticipantRow>("project_participants")
        .where({ project_id: project.id, email })
        .whereNot("status", "revoked")
        .first();
      if (existing) {
        throw new ConflictError(
          existing.status === "invited"
            ? "That person already has a pending invite to this project."
            : "That person is already on this project.",
        );
      }

      const token = generateId("pinv");
      const name = request.body.name?.trim() || null;
      const record = {
        id: generateId("pp"),
        project_id: project.id,
        user_id: null,
        email,
        name,
        role,
        side: sideFor(request.body.side, role),
        status: "invited" as const,
        invited_by_id: user.id,
        invite_token: token,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        permissions: JSON.stringify(request.body.permissions ?? {}),
        grants: request.body.grants ? JSON.stringify(request.body.grants) : null,
      };
      await db("project_participants").insert(record);

      const inviteUrl = `${appUrl}/accept-project-invite/${token}`;
      try {
        const { subject, html } = projectInviteEmail({
          inviterName: user.name,
          projectName: project.name,
          url: inviteUrl,
        });
        await sendEmail({
          to: email,
          toName: name ?? email,
          subject,
          html,
        });
      } catch (error) {
        request.log.warn({ err: error }, "Failed to send project invite email");
        captureBug(error, {
          tags: { area: "participants", channel: "email", event: "project_invite" },
          extra: { projectId: project.id, email },
        });
      }

      const row = await db<ParticipantRow>("project_participants").where({ id: record.id }).first();
      return reply.status(201).send(toParticipant(row!));
    },
  );

  fastify.patch<{ Params: { id: string; participantId: string }; Body: UpdateParticipantBody }>(
    "/projects/:id/participants/:participantId",
    { schema: { params: participantParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "manage");
      validateGrants(request, project, request.body.grants);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (request.body.role) patch.role = request.body.role;
      if (request.body.side) patch.side = request.body.side;
      if (request.body.status) patch.status = request.body.status;
      if (request.body.permissions !== undefined) patch.permissions = JSON.stringify(request.body.permissions);
      if (request.body.grants !== undefined) patch.grants = JSON.stringify(request.body.grants);
      await db("project_participants")
        .where({ id: request.params.participantId, project_id: project.id })
        .update(patch);
      const row = await db<ParticipantRow>("project_participants as p")
        .leftJoin("user as u", "u.id", "p.user_id")
        .where("p.id", request.params.participantId)
        .select(
          "p.id",
          "p.project_id",
          "p.user_id",
          "p.email",
          "p.role",
          "p.side",
          "p.status",
          "p.permissions",
          "p.grants",
          "p.invited_by_id",
          "p.created_at",
          "p.updated_at",
          db.raw("COALESCE(p.name, u.name) as name"),
        )
        .first();
      if (!row) throw new NotFoundError("Participant");
      if (row.user_id) {
        await fastify.accessCache.invalidate(row.user_id);
        fastify.realtime.publish({
          event: "access.updated",
          userId: row.user_id,
          data: { projectId: project.id },
        });
      }
      return toParticipant(row);
    },
  );

  fastify.delete<{ Params: { id: string; participantId: string } }>(
    "/projects/:id/participants/:participantId",
    { schema: { params: participantParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "manage");
      const participant = await db<ParticipantRow>("project_participants")
        .where({ id: request.params.participantId, project_id: project.id })
        .first();
      await db("project_participants")
        .where({ id: request.params.participantId, project_id: project.id })
        .update({ status: "revoked", updated_at: new Date().toISOString() });
      if (participant?.user_id) {
        await messaging.removeFromProjectChannels(project.id, participant.user_id);
        await fastify.accessCache.invalidate(participant.user_id);
        fastify.realtime.publish({
          event: "access.updated",
          userId: participant.user_id,
          data: { projectId: project.id },
        });
      }
      return reply.status(204).send();
    },
  );

  // --- The caller's relationship + capabilities for a project (drives the UI) ---
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/access",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "view");
      return computeAccess(project, request);
    },
  );
};

export default participantRoutes;
