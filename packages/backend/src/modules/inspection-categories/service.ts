import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { InspectionCategoriesRepository } from "./repository.ts";
import type {
  CategoryOwner,
  CreateCategoryInput,
  InspectionCategory,
  InspectionCategoryRow,
  UpdateCategoryInput,
} from "./types.ts";

function toCategory(row: InspectionCategoryRow, usageCount: number): InspectionCategory {
  return {
    id: row.id,
    name: row.name,
    scope: row.project_id ? "project" : "organization",
    sortOrder: row.sort_order,
    active: row.active,
    usageCount,
  };
}

export function inspectionCategoriesService(repository: InspectionCategoriesRepository) {
  async function decorate(rows: InspectionCategoryRow[]): Promise<InspectionCategory[]> {
    const counts = await repository.usageCounts(rows.map((row) => row.id));
    return rows.map((row) => toCategory(row, counts.get(row.id) ?? 0));
  }

  async function load(owner: CategoryOwner, id: string): Promise<InspectionCategoryRow> {
    const row = await repository.byId(owner, id);
    if (!row) throw new NotFoundError("Inspection category");
    return row;
  }

  return {
    async list(owner: CategoryOwner, includeArchived = false): Promise<InspectionCategory[]> {
      return decorate(await repository.list(owner, includeArchived));
    },

    /**
     * A category added on a project stays on that project; anything else joins
     * the organisation's list, which is what the rest of its jobs will pick from.
     */
    async create(
      owner: CategoryOwner,
      input: CreateCategoryInput,
      actorId: string,
    ): Promise<InspectionCategory> {
      const name = input.name.trim();
      if (name.length === 0) throw new ValidationError("Give the category a name");

      const clash = await repository.byName(owner, name);
      if (clash) {
        throw new ConflictError(
          clash.active
            ? `"${clash.name}" is already on the list`
            : `"${clash.name}" is archived on this list — restore it instead of adding a duplicate`,
          { existingId: clash.id, active: clash.active },
        );
      }

      const scope = input.scope ?? "organization";
      // An org-scoped category on a project with no workspace would be visible
      // to nobody, so it falls back to the project's own list.
      const onProject = scope === "project" || owner.organizationId === null;
      const existing = await repository.list(owner, true);
      const row: InspectionCategoryRow = {
        id: generateId("insc_"),
        organization_id: onProject ? null : owner.organizationId,
        project_id: onProject ? owner.projectId : null,
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
      owner: CategoryOwner,
      id: string,
      input: UpdateCategoryInput,
    ): Promise<InspectionCategory> {
      const row = await load(owner, id);
      const patch: Partial<InspectionCategoryRow> = {};

      if (input.name !== undefined) {
        const name = input.name.trim();
        if (name.length === 0) throw new ValidationError("Give the category a name");
        const clash = await repository.byName(owner, name);
        if (clash && clash.id !== id) {
          throw new ConflictError(`"${clash.name}" is already on the list`, {
            existingId: clash.id,
          });
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
    async remove(owner: CategoryOwner, id: string): Promise<{ archived: boolean }> {
      const row = await load(owner, id);
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
    async resolve(owner: CategoryOwner, id: string): Promise<InspectionCategoryRow> {
      const row = await load(owner, id);
      if (!row.active) throw new ValidationError("That inspection category is archived");
      return row;
    },
  };
}

export type InspectionCategoriesService = ReturnType<typeof inspectionCategoriesService>;
