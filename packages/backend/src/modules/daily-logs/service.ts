import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import type { DailyLogsRepository } from "./repository.ts";
import { assertDate, buildEntry, buildLog, stripHtml, toDay, toLogDateString } from "./mappers.ts";
import type { TemplateResponses } from "../daily-log-templates/types.ts";
import type {
  CreateDailyLogEntryInput,
  DailyLog,
  DailyLogActivityLink,
  DailyLogActivityRow,
  DailyLogDay,
  DailyLogEntry,
  DailyLogRow,
  FilledEntryForm,
  LinkActivityInput,
  UpsertDailyLogInput,
} from "./types.ts";

export interface DailyLogActivityHooks {
  assertBuilding?: (projectId: string, buildingId: string) => Promise<void>;
  createUpdate?: (
    projectId: string,
    input: { category: "Progress"; title: string; description: string; activityId: string },
    actor: { id: string; name: string },
  ) => Promise<unknown>;
  markActivityInProgress?: (projectId: string, activityId: string) => Promise<void>;
  /** Validates answers against a project's template and renders them (daily-log-templates module). */
  fillTemplate?: (projectId: string, templateId: string, responses: TemplateResponses) => Promise<FilledEntryForm>;
}

export function dailyLogsService(
  repository: DailyLogsRepository,
  hooks: DailyLogActivityHooks = {},
  soleRealBuildingId: (projectId: string) => Promise<string | undefined> = async () => undefined,
) {
  async function resolveBuildingId(projectId: string, explicit?: string | null): Promise<string> {
    if (explicit) {
      await hooks.assertBuilding?.(projectId, explicit);
      return explicit;
    }
    const buildingId = await soleRealBuildingId(projectId);
    if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    return buildingId;
  }

  async function attachActivities(rows: DailyLogRow[]): Promise<DailyLog[]> {
    if (rows.length === 0) return [];
    const keys = rows.map((r) => ({
      projectId: r.project_id,
      buildingId: r.building_id,
      logDate: toLogDateString(r.log_date),
    }));
    const links = await repository.activitiesFor(keys);
    const activityIds = Array.from(new Set(links.map((l) => l.activity_id)));
    const nameRows = await repository.activityNamesByIds(activityIds);
    const names = new Map(nameRows.map((n) => [n.id, n.name]));

    const voiderIds = rows.map((r) => r.voided_by_id).filter((id): id is string => Boolean(id));
    const voiderRows = await repository.voidersByIds(voiderIds);
    const voiderNames = new Map(voiderRows.map((v) => [v.id, v.name]));

    const linkMap = new Map<string, DailyLogActivityLink[]>();
    for (const link of links) {
      const key = `${link.project_id}|${link.building_id}|${toLogDateString(link.log_date)}`;
      const list = linkMap.get(key) ?? [];
      list.push({
        activityId: link.activity_id,
        activityName: names.get(link.activity_id) ?? link.activity_id,
        hoursLogged: Number(link.hours_logged),
      });
      linkMap.set(key, list);
    }

    return rows.map((row) =>
      buildLog(row, linkMap.get(`${row.project_id}|${row.building_id}|${toLogDateString(row.log_date)}`) ?? [], voiderNames),
    );
  }

  async function loadEntriesByDay(
    keys: { projectId: string; buildingId: string; logDate: string }[],
  ): Promise<Map<string, DailyLogEntry[]>> {
    const map = new Map<string, DailyLogEntry[]>();
    if (keys.length === 0) return map;
    const entryRows = await repository.entriesForDays(keys);
    if (entryRows.length === 0) return map;
    const voidRows = await repository.voidsForEntries(entryRows.map((e) => e.id));
    for (const row of entryRows) {
      const key = `${row.project_id}|${row.building_id}|${toLogDateString(row.log_date)}`;
      const list = map.get(key) ?? [];
      list.push(buildEntry(row, voidRows));
      map.set(key, list);
    }
    return map;
  }

  return {
    async listByProject(
      projectId: string,
      from?: string,
      to?: string,
      buildingId?: string,
    ): Promise<DailyLog[]> {
      if (from) assertDate(from, "from");
      if (to) assertDate(to, "to");
      const rows = await repository.listByProjectInRange(projectId, from, to, buildingId);
      return attachActivities(rows);
    },

    async getOne(projectId: string, logDate: string, explicitBuildingId?: string): Promise<DailyLog> {
      assertDate(logDate, "logDate");
      const buildingId = await resolveBuildingId(projectId, explicitBuildingId);
      const row = await repository.findOne({ projectId, buildingId, logDate });
      if (!row) throw new NotFoundError("Daily log");
      const [withActivities] = await attachActivities([row]);
      if (!withActivities) throw new NotFoundError("Daily log");
      return withActivities;
    },

    async upsert(
      projectId: string,
      logDate: string,
      input: UpsertDailyLogInput,
      actorId: string,
    ): Promise<DailyLog> {
      assertDate(logDate, "logDate");
      const buildingId = await resolveBuildingId(projectId, input.buildingId);
      const current = await repository.findOne({ projectId, buildingId, logDate });
      if (current?.voided_at) throw new BadRequestError("A voided daily log cannot be edited");
      await repository.upsert({ projectId, buildingId, logDate }, input, actorId);
      return this.getOne(projectId, logDate, buildingId);
    },

    async linkActivity(
      projectId: string,
      logDate: string,
      input: LinkActivityInput,
      actor?: { id: string; name: string },
    ): Promise<DailyLogActivityRow> {
      assertDate(logDate, "logDate");
      const activity = await repository.findActivity(projectId, input.activityId);
      if (!activity) throw new BadRequestError("activityId does not belong to this project");
      const buildingId = activity.building_id;

      // The day is created on demand, as addEntry does: a crew member logging
      // hours from the field should not have to save the day header first, and
      // the activity's own building decides which day the hours belong to.
      const existing = await repository.findOne({ projectId, buildingId, logDate });
      if (!existing) {
        if (!actor) throw new NotFoundError("Daily log");
        await repository.upsert({ projectId, buildingId, logDate }, {}, actor.id);
      }

      const link = await repository.upsertActivityLink(
        { projectId, buildingId, logDate },
        input.activityId,
        input.hoursLogged,
      );

      if (hooks.markActivityInProgress) {
        await hooks.markActivityInProgress(projectId, input.activityId).catch(() => undefined);
      }
      // Linking hours is a diary entry, not a stakeholder update: the client
      // feed only hears about it when the person logging says so.
      if (hooks.createUpdate && actor && input.postUpdate === true) {
        const activityName = activity.name ?? "an activity";
        await hooks
          .createUpdate(
            projectId,
            {
              category: "Progress",
              title: `Site work logged on ${activityName}`,
              description: `${input.hoursLogged} hour(s) logged against ${activityName} on ${logDate}.`,
              activityId: input.activityId,
            },
            actor,
          )
          .catch(() => undefined);
      }

      return link;
    },

    async voidLog(
      projectId: string,
      logDate: string,
      reason: string,
      actorId: string | null,
    ): Promise<DailyLog> {
      assertDate(logDate, "logDate");
      const trimmed = reason.trim();
      if (trimmed === "" || stripHtml(trimmed) === "") {
        throw new BadRequestError("A reason is required to void a daily log");
      }
      const buildingId = await resolveBuildingId(projectId);
      const existing = await repository.findOne({ projectId, buildingId, logDate });
      if (!existing) throw new NotFoundError("Daily log");
      if (existing.voided_at) throw new BadRequestError("This daily log has already been voided");
      await repository.voidOne({ projectId, buildingId, logDate }, trimmed, actorId);
      const [voided] = await attachActivities([
        { ...existing, voided_at: new Date(), voided_by_id: actorId, void_reason: trimmed },
      ]);
      if (!voided) throw new NotFoundError("Daily log");
      return voided;
    },

    async listDays(projectId: string, from?: string, to?: string, buildingId?: string): Promise<DailyLogDay[]> {
      if (from) assertDate(from, "from");
      if (to) assertDate(to, "to");
      const rows = await repository.listByProjectInRange(projectId, from, to, buildingId);
      const logs = await attachActivities(rows);
      const keys = rows.map((r) => ({ projectId: r.project_id, buildingId: r.building_id, logDate: toLogDateString(r.log_date) }));
      const entriesByDay = await loadEntriesByDay(keys);
      return logs.map((log, index) => {
        const row = rows[index]!;
        return toDay(log, entriesByDay.get(`${log.projectId}|${row.building_id}|${log.logDate}`) ?? []);
      });
    },

    async getDay(projectId: string, logDate: string, explicitBuildingId?: string): Promise<DailyLogDay> {
      assertDate(logDate, "logDate");
      const buildingId = await resolveBuildingId(projectId, explicitBuildingId);
      const row = await repository.findOne({ projectId, buildingId, logDate });
      const entriesByDay = await loadEntriesByDay([{ projectId, buildingId, logDate }]);
      const entries = entriesByDay.get(`${projectId}|${buildingId}|${logDate}`) ?? [];
      if (!row) {
        return {
          recorded: entries.length > 0,
          projectId,
          buildingId,
          logDate,
          summary: null,
          weatherCondition: null,
          temperatureC: null,
          precipitationMm: null,
          windKph: null,
          workersExpected: 0,
          workersPresent: 0,
          totalHours: 0,
          activities: [],
          entries,
          voidedAt: null,
        };
      }
      const [log] = await attachActivities([row]);
      if (!log) throw new NotFoundError("Daily log");
      return toDay(log, entries);
    },

    /**
     * A free-form entry is its body. A template entry is the filled form,
     * rendered into the body so every reader of the diary sees it, with any
     * notes or photos the author added underneath.
     */
    async addEntry(
      projectId: string,
      logDate: string,
      input: CreateDailyLogEntryInput,
      author: { id: string; name: string; role: string },
    ): Promise<DailyLogEntry> {
      assertDate(logDate, "logDate");
      const raw = input.bodyHtml ?? "";
      const hasText = stripHtml(raw) !== "";
      // Under a form, a photo with no caption is still worth keeping.
      const notes = hasText || /<img\b/i.test(raw) ? raw : null;

      let form: FilledEntryForm | null = null;
      if (input.templateId) {
        if (!hooks.fillTemplate) throw new BadRequestError("Daily log templates are not available");
        form = await hooks.fillTemplate(projectId, input.templateId, input.responses ?? {});
      } else if (!hasText) {
        throw new BadRequestError("Your daily log entry cannot be empty");
      }

      const bodyHtml = form
        ? form.html + (notes ? `<h3>Notes</h3>${notes}` : "")
        : notes;
      const notesText = input.bodyText?.trim() || null;
      const bodyText = form
        ? [form.text, notesText ? `NOTES\n${notesText}` : null].filter(Boolean).join("\n")
        : notesText;

      const buildingId = await resolveBuildingId(projectId, input.buildingId ?? null);
      const existing = await repository.findOne({ projectId, buildingId, logDate });
      if (!existing) {
        await repository.upsert({ projectId, buildingId, logDate }, {}, author.id);
      }
      const row = await repository.insertEntry({
        projectId,
        buildingId,
        logDate,
        authorId: author.id,
        authorName: author.name,
        authorRole: author.role,
        bodyHtml,
        bodyText,
        form,
      });
      return buildEntry(row, []);
    },

    async voidEntry(
      projectId: string,
      entryId: string,
      reason: string,
      actor: { id: string; name: string; canManage: boolean },
    ): Promise<DailyLogEntry> {
      const trimmed = reason.trim();
      if (trimmed === "" || stripHtml(trimmed) === "") {
        throw new BadRequestError("A reason is required to void a daily log entry");
      }
      const entry = await repository.findEntryById(entryId);
      if (!entry || entry.project_id !== projectId) throw new NotFoundError("Daily log entry");
      if (entry.author_id !== actor.id && !actor.canManage) {
        throw new BadRequestError("You can only void your own daily log entry");
      }
      await repository.insertEntryVoid({
        entryId,
        reason: trimmed,
        voidedById: actor.id,
        voidedByName: actor.name,
      });
      const voids = await repository.voidsForEntries([entryId]);
      return buildEntry(entry, voids);
    },
  };
}

export type DailyLogsService = ReturnType<typeof dailyLogsService>;
