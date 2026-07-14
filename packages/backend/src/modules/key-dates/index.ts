import type { Knex } from "knex";
import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";

export type KeyDateStatus = "Upcoming" | "Met" | "Missed";

export interface KeyDate {
  id: string;
  projectId: string;
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: KeyDateStatus;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface KeyDateRow {
  id: string;
  project_id: string;
  label: string;
  target_date: string | null;
  actual_date: string | null;
  status: KeyDateStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toKeyDate(r: KeyDateRow): KeyDate {
  return {
    id: r.id,
    projectId: r.project_id,
    label: r.label,
    targetDate: r.target_date,
    actualDate: r.actual_date,
    status: r.status,
    notes: r.notes,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const STATUS = ["Upcoming", "Met", "Missed"] as const;

const kdParams = {
  type: "object",
  required: ["id", "keyDateId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    keyDateId: { type: "string", minLength: 1 },
  },
} as const;

const bodyProps = {
  label: { type: "string", minLength: 1, maxLength: 200 },
  targetDate: { type: ["string", "null"], maxLength: 40 },
  actualDate: { type: ["string", "null"], maxLength: 40 },
  status: { type: "string", enum: STATUS },
  notes: { type: ["string", "null"], maxLength: 2000 },
} as const;

const createBody = { type: "object", required: ["label"], additionalProperties: false, properties: bodyProps } as const;
const updateBody = { type: "object", additionalProperties: false, minProperties: 1, properties: bodyProps } as const;

interface KeyDateInput {
  label?: string;
  targetDate?: string | null;
  actualDate?: string | null;
  status?: KeyDateStatus;
  notes?: string | null;
}

function toPatch(input: KeyDateInput): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.label !== undefined) p.label = input.label;
  if (input.targetDate !== undefined) p.target_date = input.targetDate;
  if (input.actualDate !== undefined) p.actual_date = input.actualDate;
  if (input.status !== undefined) p.status = input.status;
  if (input.notes !== undefined) p.notes = input.notes;
  return p;
}

const keyDateRoutes: FastifyPluginAsync = async (fastify) => {
  const db: Knex = fastify.db;

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/key-dates",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "view");
      const rows = await db<KeyDateRow>("key_dates")
        .where({ project_id: project.id })
        .orderBy([{ column: "target_date", order: "asc" }, { column: "sort_order", order: "asc" }]);
      return rows.map(toKeyDate);
    },
  );

  fastify.post<{ Params: { id: string }; Body: KeyDateInput }>(
    "/projects/:id/key-dates",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "manage");
      const record = {
        id: generateId("kd"),
        project_id: project.id,
        label: request.body.label!,
        target_date: request.body.targetDate ?? null,
        actual_date: request.body.actualDate ?? null,
        status: request.body.status ?? "Upcoming",
        notes: request.body.notes ?? null,
      };
      await db("key_dates").insert(record);
      const row = await db<KeyDateRow>("key_dates").where({ id: record.id }).first();
      return reply.status(201).send(toKeyDate(row!));
    },
  );

  fastify.patch<{ Params: { id: string; keyDateId: string }; Body: KeyDateInput }>(
    "/projects/:id/key-dates/:keyDateId",
    { schema: { params: kdParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "manage");
      const existing = await db<KeyDateRow>("key_dates")
        .where({ id: request.params.keyDateId, project_id: project.id })
        .first();
      if (!existing) throw new NotFoundError("Key date");
      await db("key_dates")
        .where({ id: request.params.keyDateId })
        .update({ ...toPatch(request.body), updated_at: new Date().toISOString() });
      const row = await db<KeyDateRow>("key_dates").where({ id: request.params.keyDateId }).first();
      return toKeyDate(row!);
    },
  );

  fastify.delete<{ Params: { id: string; keyDateId: string } }>(
    "/projects/:id/key-dates/:keyDateId",
    { schema: { params: kdParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "manage");
      await db("key_dates").where({ id: request.params.keyDateId, project_id: project.id }).del();
      return reply.status(204).send();
    },
  );
};

export default keyDateRoutes;
