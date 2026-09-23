import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import type { PreconRepository } from "./repository.ts";
import { toProgrammeTask } from "./dto.ts";
import { programmeEditor } from "./programme-editor.ts";
import { scheduleProgramme } from "./programme-schedule.ts";
import type {
  CreateProgrammeTaskBody,
  PreconProgramme,
  PreconProgrammeTaskBase,
  ProgrammeTaskOrigin,
  UpdateProgrammeTaskBody,
} from "./types.ts";

type Audit = (
  sessionId: string,
  rowId: string | null,
  actor: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => Promise<void>;

interface Deps {
  repo: PreconRepository;
  audit: Audit;
  editor: ReturnType<typeof programmeEditor>;
}

/**
 * The programme of work: the forward pass that turns durations and links into
 * dates, the task edits, and the MS Project export. Split from the main
 * service so each file stays readable.
 */
export function programmeService({ repo, audit, editor }: Deps) {
  return {
    async getProgramme(sessionId: string): Promise<PreconProgramme> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      const [rows, statusCounts] = await Promise.all([
        repo.programmeTasksBySession(sessionId),
        repo.programmeStatusCounts(sessionId),
      ]);

      const startDate = session.programme_start_date
        ? new Date(`${String(session.programme_start_date).slice(0, 10)}T00:00:00Z`)
        : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

      const tasks = rows.map(toProgrammeTask);
      const dates = scheduleProgramme(
        tasks.map((t) => ({
          id: t.id,
          durationDays: t.durationDays,
          predecessors: t.predecessors,
          outlineLevel: t.outlineLevel,
          parentTaskId: t.parentTaskId,
        })),
        startDate,
      );

      const scheduled = tasks.map((task) => {
        const window = dates.get(task.id);
        return {
          ...task,
          totalFloatDays: window?.totalFloatDays ?? null,
          isCritical: window?.isCritical ?? false,
          startAt: (window?.start ?? startDate).toISOString(),
          finishAt: (window?.finish ?? startDate).toISOString(),
        };
      });

      // Persist the analysis so the handoff and the assistant can read float
      // and critical flags straight off the rows without re-running the pass.
      await Promise.all(
        rows.flatMap((row) => {
          const window = dates.get(row.id);
          if (!window) return [];
          const unchanged =
            (row.total_float_days ?? null) === window.totalFloatDays && Boolean(row.is_critical) === window.isCritical;
          return unchanged
            ? []
            : [repo.updateProgrammeTaskDerived(row.id, { total_float_days: window.totalFloatDays, is_critical: window.isCritical })];
        }),
      );

      const total = statusCounts.reduce((sum, c) => sum + c.count, 0);
      const verified = statusCounts.find((c) => c.status === "verified")?.count ?? 0;
      const finish = scheduled.reduce<string | null>(
        (max, t) => (!max || t.finishAt > max ? t.finishAt : max),
        null,
      );

      return {
        sessionId,
        startDate: startDate.toISOString(),
        finishDate: finish,
        tasks: scheduled,
        progress: { total, verified },
      };
    },

    async setProgrammeStart(sessionId: string, startDate: string): Promise<PreconProgramme> {
      await repo.setProgrammeStartDate(sessionId, startDate);
      return this.getProgramme(sessionId);
    },

    async updateProgrammeTask(
      taskId: string,
      version: number,
      patch: Omit<UpdateProgrammeTaskBody, "version">,
      actor: string,
      origin: ProgrammeTaskOrigin = "manual",
    ): Promise<PreconProgrammeTaskBase> {
      return toProgrammeTask(await editor.updateTask(taskId, version, patch, actor, origin));
    },

    async createProgrammeTask(
      sessionId: string,
      body: CreateProgrammeTaskBody,
      actor: string,
      origin: ProgrammeTaskOrigin = "manual",
    ): Promise<PreconProgrammeTaskBase> {
      return toProgrammeTask(await editor.createTask(sessionId, body, actor, origin));
    },

    async deleteProgrammeTask(taskId: string, actor: string): Promise<{ ok: true }> {
      return editor.deleteTask(taskId, actor);
    },

    async setProgrammeTaskStatus(
      taskId: string,
      version: number,
      status: "verified" | "rejected",
      actor: string,
    ): Promise<PreconProgrammeTaskBase> {
      const existing = await repo.programmeTaskById(taskId);
      if (!existing) throw new NotFoundError("Programme task");
      const updated = await repo.updateProgrammeTaskVersioned(taskId, version, {
        status,
        verified_by: status === "verified" ? actor : null,
        verified_at: status === "verified" ? new Date() : null,
      });
      if (!updated) {
        throw new ConflictError("Task changed since you loaded it; refresh and retry");
      }
      await audit(
        existing.session_id,
        taskId,
        actor,
        `programme.${status}`,
        { status: existing.status },
        { status },
      );
      return toProgrammeTask(updated);
    },

    async exportProgrammeXml(sessionId: string): Promise<{ fileName: string; xml: string }> {
      const [programme, session] = await Promise.all([
        this.getProgramme(sessionId),
        repo.sessionById(sessionId),
      ]);
      if (programme.tasks.length === 0) {
        throw new BadRequestError("Generate the programme before exporting it.");
      }
      const title = session?.title ?? "Programme";

      // MS Project keys tasks by integer UID; a rejected task is left out
      // entirely, so links pointing at one are dropped rather than dangling.
      const included = programme.tasks.filter((t) => t.status !== "rejected");
      const uidById = new Map(included.map((t, index) => [t.id, index + 1]));

      const { buildMspdiXml } = await import("../programme/mspdi-writer.ts");
      const xml = buildMspdiXml({
        name: title,
        start: new Date(programme.startDate),
        finish: programme.finishDate ? new Date(programme.finishDate) : null,
        tasks: included.map((task) => ({
          uid: uidById.get(task.id)!,
          name: task.name,
          outlineLevel: task.outlineLevel,
          outlineNumber: task.wbsCode,
          start: new Date(task.startAt),
          finish: new Date(task.finishAt),
          durationDays: task.durationDays,
          percentComplete: 0,
          isMilestone: task.isMilestone,
          isSummary: task.outlineLevel === 1,
          predecessors: task.predecessors.flatMap((link) => {
            const uid = uidById.get(link.taskId);
            return uid === undefined ? [] : [{ uid, type: link.type, lagDays: link.lagDays }];
          }),
        })),
      });

      const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
      return { fileName: `Programme-${safeTitle}.xml`, xml };
    },
  };
}
