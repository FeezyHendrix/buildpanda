import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso } from "../../lib/dates.ts";
import { normaliseFields, normaliseResponses, renderResponses } from "./form.ts";
import type { DailyLogTemplatesRepository } from "./repository.ts";
import type {
  CreateTemplateInput,
  DailyLogTemplate,
  DailyLogTemplateRow,
  FilledTemplate,
  TemplateOwner,
  TemplateResponses,
  TemplateScope,
  UpdateTemplateInput,
} from "./types.ts";

function scopeOf(row: DailyLogTemplateRow): TemplateScope {
  return row.project_id ? "project" : "organization";
}

function toTemplate(row: DailyLogTemplateRow, usageCount: number): DailyLogTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scope: scopeOf(row),
    fields: row.fields,
    isDefault: row.is_default,
    active: row.active,
    usageCount,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * Which list a new template joins. An organisation form on a project with no
 * workspace would be visible to nobody, so it falls back to the project.
 */
function ownership(
  owner: TemplateOwner,
  scope: TemplateScope | undefined,
): Pick<DailyLogTemplateRow, "organization_id" | "project_id"> {
  const onProject = scope === "project" || owner.organizationId === null;
  return {
    organization_id: onProject ? null : owner.organizationId,
    project_id: onProject ? owner.projectId : null,
  };
}

function requireName(value: string): string {
  const name = value.trim();
  if (name === "") throw new ValidationError("Give the template a name");
  return name;
}

export function dailyLogTemplatesService(repository: DailyLogTemplatesRepository) {
  async function load(owner: TemplateOwner, id: string): Promise<DailyLogTemplateRow> {
    const row = await repository.byId(owner, id);
    if (!row) throw new NotFoundError("Daily log template");
    return row;
  }

  async function assertNameFree(row: Pick<DailyLogTemplateRow, "organization_id" | "project_id">, name: string, selfId?: string) {
    const clash = await repository.byNameInList(row, name);
    if (clash && clash.id !== selfId) {
      throw new ConflictError(
        clash.active
          ? `A template called "${clash.name}" already exists`
          : `"${clash.name}" is archived — restore it instead of adding a duplicate`,
        { existingId: clash.id },
      );
    }
  }

  async function withUsage(row: DailyLogTemplateRow): Promise<DailyLogTemplate> {
    const counts = await repository.usageCounts([row.id]);
    return toTemplate(row, counts.get(row.id) ?? 0);
  }

  return {
    async list(owner: TemplateOwner, includeArchived = false): Promise<DailyLogTemplate[]> {
      const rows = await repository.list(owner, includeArchived);
      const counts = await repository.usageCounts(rows.map((row) => row.id));
      return rows.map((row) => toTemplate(row, counts.get(row.id) ?? 0));
    },

    async create(owner: TemplateOwner, input: CreateTemplateInput, actorId: string): Promise<DailyLogTemplate> {
      const name = requireName(input.name);
      const list = ownership(owner, input.scope);
      await assertNameFree(list, name);
      const now = new Date();
      const row: DailyLogTemplateRow = {
        id: generateId("dlt"),
        ...list,
        name,
        description: input.description?.trim() || null,
        fields: normaliseFields(input.fields),
        is_default: Boolean(input.isDefault),
        active: true,
        created_by_id: actorId,
        created_at: now,
        updated_at: now,
      };
      if (row.is_default) await repository.clearDefault(list);
      await repository.insert(row);
      return toTemplate(row, 0);
    },

    /**
     * Entries already filled keep the field snapshot they were made against, so
     * editing a form in use is safe: it changes tomorrow's diary, not last week's.
     */
    async update(owner: TemplateOwner, id: string, input: UpdateTemplateInput): Promise<DailyLogTemplate> {
      const row = await load(owner, id);
      const patch: Partial<DailyLogTemplateRow> = {};
      if (input.name !== undefined) {
        patch.name = requireName(input.name);
        await assertNameFree(row, patch.name, id);
      }
      if (input.description !== undefined) patch.description = input.description?.trim() || null;
      if (input.fields !== undefined) patch.fields = normaliseFields(input.fields);
      if (input.active !== undefined) patch.active = input.active;
      if (input.isDefault !== undefined) patch.is_default = input.isDefault;
      // An archived form cannot be the one a new entry opens on.
      if (patch.active === false) patch.is_default = false;

      if (patch.is_default) await repository.clearDefault(row);
      await repository.update(id, patch);
      return withUsage({ ...row, ...patch });
    },

    /** Deleting a template entries were filled against would orphan their history label, so a used one is archived. */
    async remove(owner: TemplateOwner, id: string): Promise<{ archived: boolean }> {
      const row = await load(owner, id);
      const counts = await repository.usageCounts([id]);
      if ((counts.get(id) ?? 0) > 0) {
        await repository.update(id, { active: false, is_default: false });
        return { archived: true };
      }
      await repository.remove(row.id);
      return { archived: false };
    },

    /** Used by the daily-log module: validate a filled form and render it for the record. */
    async fill(projectId: string, id: string, raw: TemplateResponses): Promise<FilledTemplate> {
      const row = await repository.byIdForProject(projectId, id);
      if (!row) throw new NotFoundError("Daily log template");
      if (!row.active) throw new ValidationError("That daily log template is archived");
      const responses = normaliseResponses(row.fields, raw);
      const { html, text } = renderResponses(row.fields, responses);
      return { templateId: row.id, templateName: row.name, fields: row.fields, responses, html, text };
    },
  };
}

export type DailyLogTemplatesService = ReturnType<typeof dailyLogTemplatesService>;
