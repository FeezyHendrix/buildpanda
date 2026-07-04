import type { Knex } from "knex";
import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";

export type PermitStatus = "NotStarted" | "Applied" | "Approved" | "Rejected" | "Expired";

export type PermitUrgency = "expired" | "expiringSoon" | "active" | "none";

const EXPIRING_WINDOW_DAYS = 30;

export interface Permit {
  id: string;
  projectId: string;
  title: string;
  authority: string | null;
  referenceNo: string | null;
  status: PermitStatus;
  appliedDate: string | null;
  approvedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  urgency: PermitUrgency;
  daysUntilExpiry: number | null;
  createdAt: string;
  updatedAt: string;
}

function daysBetweenTodayAnd(dateIso: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const target = new Date(dateIso.slice(0, 10)).getTime();
  return Math.round((target - today) / 86_400_000);
}

// Urgency is derived from the expiry date and status, so a permit's real-world
// risk (expired / expiring within 30 days) is a single field consumers share.
function computeUrgency(
  status: PermitStatus,
  expiryDate: string | null,
): { urgency: PermitUrgency; daysUntilExpiry: number | null } {
  if (!expiryDate) return { urgency: "none", daysUntilExpiry: null };
  const days = daysBetweenTodayAnd(expiryDate);
  if (status === "Rejected") return { urgency: "none", daysUntilExpiry: days };
  if (days < 0) return { urgency: "expired", daysUntilExpiry: days };
  if (days <= EXPIRING_WINDOW_DAYS) return { urgency: "expiringSoon", daysUntilExpiry: days };
  return { urgency: "active", daysUntilExpiry: days };
}

// Status follows the dates unless the caller sends an explicit status. An expiry
// in the past wins outright; otherwise the furthest-progressed date drives it.
function inferStatus(
  explicit: PermitStatus | undefined,
  dates: { appliedDate: string | null; approvedDate: string | null; expiryDate: string | null },
): PermitStatus {
  if (explicit) return explicit;
  if (dates.expiryDate && daysBetweenTodayAnd(dates.expiryDate) < 0) return "Expired";
  if (dates.approvedDate) return "Approved";
  if (dates.appliedDate) return "Applied";
  return "NotStarted";
}

interface PermitRow {
  id: string;
  project_id: string;
  title: string;
  authority: string | null;
  reference_no: string | null;
  status: PermitStatus;
  applied_date: string | null;
  approved_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toPermit(r: PermitRow): Permit {
  const { urgency, daysUntilExpiry } = computeUrgency(r.status, r.expiry_date);
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    authority: r.authority,
    referenceNo: r.reference_no,
    status: r.status,
    appliedDate: r.applied_date,
    approvedDate: r.approved_date,
    expiryDate: r.expiry_date,
    notes: r.notes,
    urgency,
    daysUntilExpiry,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const STATUS = ["NotStarted", "Applied", "Approved", "Rejected", "Expired"] as const;

const permitParams = {
  type: "object",
  required: ["id", "permitId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    permitId: { type: "string", minLength: 1 },
  },
} as const;

const bodyProps = {
  title: { type: "string", minLength: 1, maxLength: 200 },
  authority: { type: ["string", "null"], maxLength: 200 },
  referenceNo: { type: ["string", "null"], maxLength: 120 },
  status: { type: "string", enum: STATUS },
  appliedDate: { type: ["string", "null"], maxLength: 40 },
  approvedDate: { type: ["string", "null"], maxLength: 40 },
  expiryDate: { type: ["string", "null"], maxLength: 40 },
  notes: { type: ["string", "null"], maxLength: 2000 },
} as const;

const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: bodyProps,
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: bodyProps,
} as const;

interface PermitInput {
  title?: string;
  authority?: string | null;
  referenceNo?: string | null;
  status?: PermitStatus;
  appliedDate?: string | null;
  approvedDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}

function toPatch(input: PermitInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.authority !== undefined) patch.authority = input.authority;
  if (input.referenceNo !== undefined) patch.reference_no = input.referenceNo;
  if (input.status !== undefined) patch.status = input.status;
  if (input.appliedDate !== undefined) patch.applied_date = input.appliedDate;
  if (input.approvedDate !== undefined) patch.approved_date = input.approvedDate;
  if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
  if (input.notes !== undefined) patch.notes = input.notes;
  return patch;
}

const permitRoutes: FastifyPluginAsync = async (fastify) => {
  const db: Knex = fastify.db;

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/permits",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      // Permits with an expiry sort first (soonest first) so anything expired or
      // expiring surfaces at the top; dateless permits fall to the bottom.
      const rows = await db<PermitRow>("permits")
        .where({ project_id: project.id })
        .orderByRaw("expiry_date asc nulls last")
        .orderBy("created_at", "desc");
      return rows.map(toPermit);
    },
  );

  fastify.post<{ Params: { id: string }; Body: PermitInput }>(
    "/projects/:id/permits",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const appliedDate = request.body.appliedDate ?? null;
      const approvedDate = request.body.approvedDate ?? null;
      const expiryDate = request.body.expiryDate ?? null;
      const record = {
        id: generateId("permit"),
        project_id: project.id,
        title: request.body.title!,
        authority: request.body.authority ?? null,
        reference_no: request.body.referenceNo ?? null,
        status: inferStatus(request.body.status, { appliedDate, approvedDate, expiryDate }),
        applied_date: appliedDate,
        approved_date: approvedDate,
        expiry_date: expiryDate,
        notes: request.body.notes ?? null,
      };
      await db("permits").insert(record);
      const row = await db<PermitRow>("permits").where({ id: record.id }).first();
      return reply.status(201).send(toPermit(row!));
    },
  );

  fastify.patch<{ Params: { id: string; permitId: string }; Body: PermitInput }>(
    "/projects/:id/permits/:permitId",
    { schema: { params: permitParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      const existing = await db<PermitRow>("permits")
        .where({ id: request.params.permitId, project_id: project.id })
        .first();
      if (!existing) throw new NotFoundError("Permit");
      const patch = toPatch(request.body);
      // Re-derive status from the effective dates unless the caller set it
      // explicitly, so date edits keep the status accurate.
      if (request.body.status === undefined) {
        patch.status = inferStatus(undefined, {
          appliedDate: (patch.applied_date as string | null | undefined) ?? existing.applied_date,
          approvedDate: (patch.approved_date as string | null | undefined) ?? existing.approved_date,
          expiryDate: (patch.expiry_date as string | null | undefined) ?? existing.expiry_date,
        });
      }
      await db("permits")
        .where({ id: request.params.permitId })
        .update({ ...patch, updated_at: new Date().toISOString() });
      const row = await db<PermitRow>("permits").where({ id: request.params.permitId }).first();
      return toPermit(row!);
    },
  );

  fastify.delete<{ Params: { id: string; permitId: string } }>(
    "/projects/:id/permits/:permitId",
    { schema: { params: permitParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await db("permits").where({ id: request.params.permitId, project_id: project.id }).del();
      return reply.status(204).send();
    },
  );
};

export default permitRoutes;
