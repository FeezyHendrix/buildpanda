import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { RateLibraryRepository } from "./repository.ts";
import type { AssemblyItem, PreconAssembly, PreconAssemblyRow, PricedAssembly, UpsertAssemblyInput } from "./types.ts";

export type AssemblyService = ReturnType<typeof assemblyService>;

function toAssembly(r: PreconAssemblyRow): PreconAssembly {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    elementGroup: r.element_group,
    items: (r.items ?? []).map((i) => ({ ...i, factor: Number(i.factor) })),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const clean = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Every item must be able to produce a bill line on its own: a description,
 * a unit and a positive factor. An item without an element group files under
 * the assembly's, so the bill still groups it sensibly.
 */
export function normaliseItems(items: AssemblyItem[], elementGroup: string): AssemblyItem[] {
  if (!items.length) throw new BadRequestError("An assembly needs at least one item");
  return items.map((item, index) => {
    const description = clean(item.description);
    const unit = clean(item.unit);
    if (!description) throw new BadRequestError(`Item ${index + 1} needs a description`);
    if (!unit) throw new BadRequestError(`Item ${index + 1} needs a unit`);
    if (!(Number.isFinite(item.factor) && item.factor > 0)) throw new BadRequestError(`Item ${index + 1} needs a factor above zero`);
    return {
      description,
      unit,
      factor: Math.round(item.factor * 10000) / 10000,
      elementGroup: clean(item.elementGroup) ?? elementGroup,
      rateId: clean(item.rateId),
      code: clean(item.code),
    };
  });
}

/**
 * Assemblies are org-level library data, like rate cards: a wall length
 * measured once bills as blockwork, plaster, paint and DPC at their own
 * factors and rates. Rates are resolved at measuring time so a repriced
 * card flows into the next line drawn, never into lines already billed.
 */
export function assemblyService(repo: RateLibraryRepository) {
  async function requireAssembly(orgId: string, id: string): Promise<PreconAssemblyRow> {
    const row = await repo.assemblyById(id);
    if (!row || row.org_id !== orgId) throw new NotFoundError("Assembly");
    return row;
  }

  // one query for every rate the items point at; an id outside the org's cards is rejected
  async function ratesFor(orgId: string, items: AssemblyItem[]): Promise<Map<string, number>> {
    const ids = [...new Set(items.map((i) => i.rateId).filter((id): id is string => Boolean(id)))];
    const rates = await repo.ratesByIdsForOrg(ids, orgId);
    const found = new Map(rates.map((r) => [r.id, Number(r.rate)]));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) throw new BadRequestError("An item points at a rate that is not in this organisation's rate library");
    return found;
  }

  return {
    async list(orgId: string): Promise<PreconAssembly[]> {
      return (await repo.assembliesByOrg(orgId)).map(toAssembly);
    },

    async create(orgId: string, actor: string, input: UpsertAssemblyInput): Promise<PreconAssembly> {
      const name = clean(input.name);
      const unit = clean(input.unit);
      const elementGroup = clean(input.elementGroup);
      if (!name || !unit || !elementGroup) throw new BadRequestError("An assembly needs a name, a unit and an element group");
      const items = normaliseItems(input.items, elementGroup);
      await ratesFor(orgId, items);
      const row = await repo.insertAssembly({
        id: generateId("pasm"),
        org_id: orgId,
        name,
        unit,
        element_group: elementGroup,
        items,
        created_by: actor,
      });
      return toAssembly(row);
    },

    async update(orgId: string, id: string, patch: Partial<UpsertAssemblyInput>): Promise<PreconAssembly> {
      const current = await requireAssembly(orgId, id);
      const dbPatch: Partial<Pick<PreconAssemblyRow, "name" | "unit" | "element_group" | "items">> = {};
      if (patch.name !== undefined) {
        const name = clean(patch.name);
        if (!name) throw new BadRequestError("An assembly needs a name");
        dbPatch.name = name;
      }
      if (patch.unit !== undefined) {
        const unit = clean(patch.unit);
        if (!unit) throw new BadRequestError("An assembly needs a unit");
        dbPatch.unit = unit;
      }
      if (patch.elementGroup !== undefined) {
        const group = clean(patch.elementGroup);
        if (!group) throw new BadRequestError("An assembly needs an element group");
        dbPatch.element_group = group;
      }
      if (patch.items !== undefined) {
        dbPatch.items = normaliseItems(patch.items, dbPatch.element_group ?? current.element_group);
        await ratesFor(orgId, dbPatch.items);
      }
      if (!Object.keys(dbPatch).length) return toAssembly(current);
      const updated = await repo.updateAssembly(id, dbPatch);
      return toAssembly(updated ?? current);
    },

    async remove(orgId: string, id: string): Promise<{ ok: true }> {
      await requireAssembly(orgId, id);
      await repo.deleteAssembly(id, orgId);
      return { ok: true };
    },

    // What a measurement needs: the assembly with each item's current rate.
    // A rate deleted since the assembly was saved leaves that item unpriced.
    async priced(orgId: string, id: string): Promise<PricedAssembly> {
      const assembly = toAssembly(await requireAssembly(orgId, id));
      const ids = assembly.items.map((i) => i.rateId).filter((rateId): rateId is string => Boolean(rateId));
      const rates = new Map((await repo.ratesByIdsForOrg([...new Set(ids)], orgId)).map((r) => [r.id, Number(r.rate)]));
      return {
        ...assembly,
        items: assembly.items.map((item) => ({ ...item, rate: item.rateId ? (rates.get(item.rateId) ?? null) : null })),
      };
    },
  };
}
