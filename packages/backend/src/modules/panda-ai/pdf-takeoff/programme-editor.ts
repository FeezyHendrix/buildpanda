import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { deriveParentIds, findDependencyCycle } from "./programme-schedule.ts";
import type { PreconRepository } from "./repository.ts";
import type {
  CreateProgrammeTaskBody,
  PreconProgrammeTaskRow,
  ProgrammeDependency,
  ProgrammeTaskOrigin,
  UpdateProgrammeTaskBody,
} from "./types.ts";

// Human editing of a drafted programme: fields, dependencies, outline and order.
// Every write here is what a person (or a person through a prompt) does to the
// AI's draft, so the row's origin moves off "ai" and its status drops back to
// needs_review — the planner owns it now.

type AuditFn = (
  sessionId: string,
  rowId: string | null,
  actor: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => Promise<void>;

const DEPENDENCY_TYPES = new Set(["FS", "SS", "FF", "SF"]);

function parsePredecessors(row: PreconProgrammeTaskRow): ProgrammeDependency[] {
  return typeof row.predecessors === "string"
    ? (JSON.parse(row.predecessors) as ProgrammeDependency[])
    : row.predecessors;
}

function cleanPredecessors(taskId: string, links: ProgrammeDependency[], sessionIds: Set<string>): ProgrammeDependency[] {
  const seen = new Set<string>();
  const cleaned: ProgrammeDependency[] = [];
  for (const link of links) {
    if (link.taskId === taskId) throw new BadRequestError("A task cannot depend on itself");
    if (!sessionIds.has(link.taskId)) throw new BadRequestError("Predecessor is not a task in this programme");
    if (!DEPENDENCY_TYPES.has(link.type)) throw new BadRequestError("Dependency type must be FS, SS, FF or SF");
    if (seen.has(link.taskId)) continue;
    seen.add(link.taskId);
    cleaned.push({ taskId: link.taskId, type: link.type, lagDays: Math.round(link.lagDays ?? 0) });
  }
  return cleaned;
}

function assertAcyclic(rows: PreconProgrammeTaskRow[], override: { id: string; predecessors: ProgrammeDependency[] }): void {
  const graph = rows.map((r) => ({
    id: r.id,
    predecessors: r.id === override.id ? override.predecessors : parsePredecessors(r),
  }));
  if (!graph.some((g) => g.id === override.id)) graph.push(override);
  const loop = findDependencyCycle(graph);
  if (loop) {
    const names = new Map(rows.map((r) => [r.id, r.name]));
    throw new BadRequestError(
      `That link would create a dependency loop: ${loop.map((id) => names.get(id) ?? "new task").join(" → ")}`,
    );
  }
}

export function programmeEditor(repo: PreconRepository, audit: AuditFn) {
  // Sort and parent are consequences of the whole list, so they are re-derived
  // after any structural change and written without bumping versions.
  async function normalise(sessionId: string, orderedIds?: string[]): Promise<void> {
    const rows = await repo.programmeTasksBySession(sessionId);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = orderedIds ? orderedIds.map((id) => byId.get(id)).filter((r): r is PreconProgrammeTaskRow => Boolean(r)) : rows;
    const parents = deriveParentIds(ordered.map((r) => ({ id: r.id, outlineLevel: r.outline_level })));
    await Promise.all(
      ordered.map((row, index) => {
        const parent = parents.get(row.id) ?? null;
        if (row.sort === index && row.parent_task_id === parent) return Promise.resolve();
        return repo.updateProgrammeTaskDerived(row.id, { sort: index, parent_task_id: parent });
      }),
    );
  }

  return {
    async updateTask(
      taskId: string,
      version: number,
      patch: Omit<UpdateProgrammeTaskBody, "version">,
      actor: string,
      origin: ProgrammeTaskOrigin = "manual",
    ): Promise<PreconProgrammeTaskRow> {
      const existing = await repo.programmeTaskById(taskId);
      if (!existing) throw new NotFoundError("Programme task");
      const rows = await repo.programmeTasksBySession(existing.session_id);
      const sessionIds = new Set(rows.map((r) => r.id));

      let predecessors: ProgrammeDependency[] | undefined;
      if (patch.predecessors !== undefined) {
        predecessors = cleanPredecessors(taskId, patch.predecessors, sessionIds);
        assertAcyclic(rows, { id: taskId, predecessors });
      }

      const updated = await repo.updateProgrammeTaskVersioned(taskId, version, {
        ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
        ...(patch.durationDays === undefined ? {} : { duration_days: patch.isMilestone ? 0 : patch.durationDays }),
        ...(patch.isMilestone === undefined ? {} : { is_milestone: patch.isMilestone, ...(patch.isMilestone ? { duration_days: 0 } : {}) }),
        ...(patch.basis === undefined ? {} : { basis: patch.basis }),
        ...(patch.outlineLevel === undefined ? {} : { outline_level: patch.outlineLevel }),
        ...(predecessors === undefined ? {} : { predecessors }),
        origin,
        // An edited task is the planner's call now, not the model's.
        status: "needs_review",
        verified_by: null,
        verified_at: null,
      });
      if (!updated) throw new ConflictError("Task changed since you loaded it; refresh and retry");

      if (patch.sort !== undefined || patch.outlineLevel !== undefined) {
        const ids = rows.map((r) => r.id);
        if (patch.sort !== undefined) {
          const from = ids.indexOf(taskId);
          if (from !== -1) ids.splice(from, 1);
          ids.splice(Math.max(0, Math.min(patch.sort, ids.length)), 0, taskId);
        }
        await normalise(existing.session_id, ids);
      }

      await audit(existing.session_id, taskId, actor, "programme.updated", { name: existing.name }, { ...patch, origin });
      const fresh = await repo.programmeTaskById(taskId);
      return fresh ?? updated;
    },

    async createTask(sessionId: string, body: CreateProgrammeTaskBody, actor: string, origin: ProgrammeTaskOrigin = "manual") {
      const rows = await repo.programmeTasksBySession(sessionId);
      const sessionIds = new Set(rows.map((r) => r.id));
      const id = generateId("ppt");
      const predecessors = body.predecessors ? cleanPredecessors(id, body.predecessors, sessionIds) : [];
      assertAcyclic(rows, { id, predecessors });

      const after = body.afterTaskId ? rows.find((r) => r.id === body.afterTaskId) : undefined;
      if (body.afterTaskId && !after) throw new NotFoundError("Task to insert after");
      const outlineLevel = body.outlineLevel ?? after?.outline_level ?? 2;

      const inserted = await repo.insertProgrammeTask({
        id,
        session_id: sessionId,
        sort: rows.length,
        name: body.name.trim(),
        element_group: after?.element_group ?? null,
        wbs_code: null,
        outline_level: outlineLevel,
        parent_task_id: null,
        duration_days: body.isMilestone ? 0 : body.durationDays,
        predecessors,
        is_milestone: body.isMilestone ?? false,
        basis: body.basis ?? null,
        confidence: null,
        status: "needs_review",
        version: 1,
        verified_by: null,
        verified_at: null,
        total_float_days: null,
        is_critical: false,
        origin,
      });

      const ids = rows.map((r) => r.id);
      const at = after ? ids.indexOf(after.id) + 1 : ids.length;
      ids.splice(at, 0, id);
      await normalise(sessionId, ids);

      await audit(sessionId, id, actor, "programme.task_created", null, { name: inserted.name, origin });
      return (await repo.programmeTaskById(id)) ?? inserted;
    },

    async deleteTask(taskId: string, actor: string): Promise<{ ok: true }> {
      const existing = await repo.programmeTaskById(taskId);
      if (!existing) throw new NotFoundError("Programme task");
      const rows = await repo.programmeTasksBySession(existing.session_id);

      // Links into the deleted task are dropped rather than left dangling;
      // children are kept and re-parented by the outline pass below.
      await Promise.all(
        rows
          .filter((r) => r.id !== taskId && parsePredecessors(r).some((l) => l.taskId === taskId))
          .map((r) =>
            repo.updateProgrammeTaskDerived(r.id, {
              predecessors: parsePredecessors(r).filter((l) => l.taskId !== taskId),
            }),
          ),
      );
      await repo.deleteProgrammeTask(taskId);
      await normalise(existing.session_id);
      await audit(existing.session_id, taskId, actor, "programme.task_deleted", { name: existing.name }, null);
      return { ok: true };
    },
  };
}

export type ProgrammeEditor = ReturnType<typeof programmeEditor>;
