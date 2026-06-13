import type { Knex } from "knex";
import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";

export type PermitStatus = "NotStarted" | "Applied" | "Approved" | "Rejected" | "Expired";

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
  createdAt: string;
  updatedAt: string;
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
      const rows = await db<PermitRow>("permits")
        .where({ project_id: project.id })
        .orderBy("created_at", "desc");
      return rows.map(toPermit);
    },
  );

  fastify.post<{ Params: { id: string }; Body: PermitInput }>(
    "/projects/:id/permits",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const record = {
        id: generateId("permit"),
        project_id: project.id,
        title: request.body.title!,
        authority: request.body.authority ?? null,
        reference_no: request.body.referenceNo ?? null,
        status: request.body.status ?? "NotStarted",
        applied_date: request.body.appliedDate ?? null,
        approved_date: request.body.approvedDate ?? null,
        expiry_date: request.body.expiryDate ?? null,
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
      await db("permits")
        .where({ id: request.params.permitId })
        .update({ ...toPatch(request.body), updated_at: new Date().toISOString() });
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
