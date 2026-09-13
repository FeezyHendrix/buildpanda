import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { InspectionCategoriesRepository } from "./repository.ts";
import type {
  CategoryAudience,
  CategoryScope,
  CreateCategoryInput,
  InspectionCategory,
  InspectionCategoryRow,
  UpdateCategoryInput,
} from "./types.ts";

function scopeOf(row: InspectionCategoryRow): CategoryScope {
  if (row.project_id) return "project";
  if (row.organization_id) return "organization";
  return "global";
}

function toCategory(row: InspectionCategoryRow, usageCount: number): InspectionCategory {
  return {
    id: row.id,
    name: row.name,
    scope: scopeOf(row),
    sortOrder: row.sort_order,
    active: row.active,
    usageCount,
  };
}

const SCOPE_RANK: Record<CategoryScope, number> = { project: 3, organization: 2, global: 1 };

/**
 * A workspace that adds a name BuildPanda also offers would otherwise show it
 * twice in the picker. The more specific row wins — the customer's own wording
 * is what their people recognise.
 */
function dedupeByName(rows: InspectionCategoryRow[]): InspectionCategoryRow[] {
  const best = new Map<string, InspectionCategoryRow>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const held = best.get(key);
    if (!held || SCOPE_RANK[scopeOf(row)] > SCOPE_RANK[scopeOf(held)]) best.set(key, row);
  }
  return rows.filter((row) => best.get(row.name.trim().toLowerCase()) === row);
}

function clashMessage(clash: InspectionCategoryRow): string {
  if (scopeOf(clash) === "global") {
    return clash.active
      ? `"${clash.name}" is already on BuildPanda's inspection catalogue`
      : `"${clash.name}" has been retired from BuildPanda's catalogue — ask BuildPanda to restore it`;
  }
  return clash.active
    ? `"${clash.name}" is already on the list`
    : `"${clash.name}" is archived on this list — restore it instead of adding a duplicate`;
}

export function inspectionCategoriesService(repository: InspectionCategoriesRepository) {
  async function decorate(rows: InspectionCategoryRow[]): Promise<InspectionCategory[]> {
    const counts = await repository.usageCounts(rows.map((row) => row.id));
    return rows.map((row) => toCategory(row, counts.get(row.id) ?? 0));
  }

  async function load(audience: CategoryAudience, id: string): Promise<InspectionCategoryRow> {
    const row = await repository.byId(audience, id);
    if (!row) throw new NotFoundError("Inspection category");
    return row;
  }

  /**
   * A workspace reads the global catalogue but does not edit it. Renaming or
   * archiving a BuildPanda category would change it for every other customer.
   */
  async function loadEditable(
    audience: CategoryAudience,
    id: string,
  ): Promise<InspectionCategoryRow> {
    const row = await load(audience, id);
    if (!("global" in audience) && scopeOf(row) === "global") {
      throw new ForbiddenError(
        "This category is part of BuildPanda's inspection catalogue — only BuildPanda can change it",
      );
    }
    return row;
  }

  return {
    async list(audience: CategoryAudience, includeArchived = false): Promise<InspectionCategory[]> {
      return decorate(dedupeByName(await repository.list(audience, includeArchived)));
    },

    /**
     * A category added on a project stays on that project; anything else joins
     * the organisation's list, which is what the rest of its jobs will pick
     * from. BuildPanda staff working on the catalogue add a global row that
     * every project on the platform then sees.
     */
    async create(
      audience: CategoryAudience,
      input: CreateCategoryInput,
      actorId: string,
    ): Promise<InspectionCategory> {
      const name = input.name.trim();
      if (name.length === 0) throw new ValidationError("Give the category a name");

      const clash = await repository.byName(audience, name);
      if (clash) {
        throw new ConflictError(clashMessage(clash), {
          existingId: clash.id,
          active: clash.active,
          scope: scopeOf(clash),
        });
      }

      const existing = await repository.list(audience, true);
      const row: InspectionCategoryRow = {
        id: generateId("insc_"),
        ...ownership(audience, input.scope),
        name,
        sort_order: input.sortOrder ?? existing.length,
        active: true,
        created_by_id: actorId,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await repository.insert(row);
      return toCategory(row, 0);
    },

    async update(
      audience: CategoryAudience,
      id: string,
      input: UpdateCategoryInput,
    ): Promise<InspectionCategory> {
      const row = await loadEditable(audience, id);
      const patch: Partial<InspectionCategoryRow> = {};

      if (input.name !== undefined) {
        const name = input.name.trim();
        if (name.length === 0) throw new ValidationError("Give the category a name");
        const clash = await repository.byName(audience, name);
        if (clash && clash.id !== id) {
          throw new ConflictError(clashMessage(clash), { existingId: clash.id });
        }
        patch.name = name;
      }
      if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
      if (input.active !== undefined) patch.active = input.active;

      await repository.update(id, patch);
      // Inspections carry the name as well, so a rename reads through to the
      // records rather than leaving old and new names side by side in a list.
      if (patch.name) await repository.renameOnInspections(id, patch.name);

      const counts = await repository.usageCounts([id]);
      return toCategory({ ...row, ...patch }, counts.get(id) ?? 0);
    },

    /**
     * Deleting a category an inspection holds would erase what was inspected,
     * so a used category is archived: it leaves the picker and keeps its records.
     */
    async remove(audience: CategoryAudience, id: string): Promise<{ archived: boolean }> {
      const row = await loadEditable(audience, id);
      const counts = await repository.usageCounts([id]);
      const used = counts.get(id) ?? 0;
      if (used > 0) {
        await repository.update(id, { active: false });
        return { archived: true };
      }
      await repository.remove(row.id);
      return { archived: false };
    },

    /** Used by the inspections module to resolve a picked category to its name. */
    async resolve(audience: CategoryAudience, id: string): Promise<InspectionCategoryRow> {
      const row = await load(audience, id);
      if (!row.active) throw new ValidationError("That inspection category is archived");
      return row;
    },
  };
}

/**
 * Which list the new row lands on. An org-scoped category on a project with no
 * workspace would be visible to nobody, so it falls back to the project's own
 * list; a global row is owned by nobody but the platform.
 */
function ownership(
  audience: CategoryAudience,
  scope: CategoryScope | undefined,
): Pick<InspectionCategoryRow, "organization_id" | "project_id"> {
  if ("global" in audience) return { organization_id: null, project_id: null };
  const onProject = scope === "project" || audience.organizationId === null;
  return {
    organization_id: onProject ? null : audience.organizationId,
    project_id: onProject ? audience.projectId : null,
  };
}

export type InspectionCategoriesService = ReturnType<typeof inspectionCategoriesService>;
