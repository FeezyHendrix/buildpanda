import type { Knex } from "knex";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { participantRole } from "../../lib/authorization.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { sendEmail } from "../../lib/mail.ts";
import { captureBug } from "../../lib/sentry.ts";
import { projectInviteEmail } from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";
import { messagingRepository } from "../messaging/repository.ts";
import { messagingService } from "../messaging/service.ts";

type ParticipantRole = string;
type ParticipantStatus = "invited" | "active" | "revoked";

interface ParticipantRow {
  id: string;
  project_id: string;
  user_id: string | null;
  email: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  invited_by_id: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  name?: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamEntry {
  id: string;
  projectId: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: ParticipantRole | "owner";
  status: ParticipantStatus;
  createdAt: string;
}

function toParticipant(r: ParticipantRow): TeamEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id,
    name: r.name ?? null,
    email: r.email,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
  };
}

const appUrl = config.mail.appUrl;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const participantParams = {
  type: "object",
  required: ["id", "participantId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    participantId: { type: "string", minLength: 1 },
  },
} as const;

const tokenParams = {
  type: "object",
  required: ["token"],
  additionalProperties: false,
  properties: { token: { type: "string", minLength: 1 } },
} as const;

const inviteBody = {
  type: "object",
  required: ["email"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 3, maxLength: 200 },
    name: { type: "string", maxLength: 120 },
    role: { type: "string", minLength: 1, maxLength: 80 },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    role: { type: "string", minLength: 1, maxLength: 80 },
    status: { type: "string", enum: ["invited", "active", "revoked"] },
  },
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

function computeAccess(
  project: { id: string; owner_id: string | null; organization_id: string | null },
  request: FastifyRequest,
) {
  const ctx = {
    userId: request.user!.id,
    orgRoles: request.orgRoles,
    projectRoles: request.projectRoles,
  };
  const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
  const orgRole = project.organization_id ? request.orgRoles.get(project.organization_id) : undefined;
  const pRole = participantRole(scope, ctx);

  let relationship: "company" | ParticipantRole | "none" = "none";
  if (orgRole) relationship = "company";
  else if (pRole) relationship = pRole as ParticipantRole;
  else if (project.owner_id === request.user!.id) relationship = "company";

  const isCompanyManager = relationship === "company" && orgRole !== "viewer";
  const isClient = relationship === "client";

  return {
    relationship,
    orgRole: orgRole ?? null,
    capabilities: {
      canManage: isCompanyManager,
      canViewAll: relationship !== "none",
      canManageParticipants: isCompanyManager,
      canDecideApprovals: isCompanyManager || isClient,
      canRaiseQueries: isCompanyManager || isClient,
      canComment: relationship !== "none" && relationship !== "guest",
    },
  };
}

const participantRoutes: FastifyPluginAsync = async (fastify) => {
  const db: Knex = fastify.db;
  const messaging = messagingService(messagingRepository(fastify.db));

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
      const project = await request.requireProjectWrite(request.params.id);
      const rows = await db<ParticipantRow>("project_participants as p")
        .leftJoin("user as u", "u.id", "p.user_id")
        .where("p.project_id", project.id)
        .whereNot("p.status", "revoked")
        .select("p.*", "u.name as name")
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
          status: "active",
          createdAt: String(project.created_at),
        });
      }
      return participants;
    },
  );

  fastify.post<{ Params: { id: string }; Body: { email: string; name?: string; role?: ParticipantRole } }>(
    "/projects/:id/participants/invite",
    { schema: { params: projectIdParams, body: inviteBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "manage");
      const user = request.requireAuth();

      const email = request.body.email.trim().toLowerCase();
      const role = request.body.role?.trim() || "client";
      const existing = await db<ParticipantRow>("project_participants")
        .where({ project_id: project.id, email })
        .whereNot("status", "revoked")
        .first();
      if (existing) throw new BadRequestError("That person is already invited to this project.");

      const token = generateId("pinv");
      const record = {
        id: generateId("pp"),
        project_id: project.id,
        user_id: null,
        email,
        role,
        status: "invited" as const,
        invited_by_id: user.id,
        invite_token: token,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
          toName: request.body.name ?? email,
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

  fastify.patch<{ Params: { id: string; participantId: string }; Body: { role?: ParticipantRole; status?: ParticipantStatus } }>(
    "/projects/:id/participants/:participantId",
    { schema: { params: participantParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "participants", "manage");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (request.body.role) patch.role = request.body.role;
      if (request.body.status) patch.status = request.body.status;
      await db("project_participants")
        .where({ id: request.params.participantId, project_id: project.id })
        .update(patch);
      const row = await db<ParticipantRow>("project_participants as p")
        .leftJoin("user as u", "u.id", "p.user_id")
        .where("p.id", request.params.participantId)
        .select("p.*", "u.name as name")
        .first();
      if (!row) throw new NotFoundError("Participant");
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
      }
      return reply.status(204).send();
    },
  );

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
      await db("project_participants").where({ id: invite.id }).update({
        user_id: user.id,
        status: "active",
        invite_token: null,
        updated_at: new Date().toISOString(),
      });
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

  // --- The caller's relationship + capabilities for a project (drives the UI) ---
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/access",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return computeAccess(project, request);
    },
  );
};

export default participantRoutes;
