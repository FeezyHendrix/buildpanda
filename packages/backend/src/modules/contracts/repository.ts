import type { Knex } from "knex";
import type { ContractRow, ContractUpdatePatch, NewContractRecord } from "./types.ts";

export function contractsRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<ContractRow[]> {
      return db<ContractRow>("project_contracts")
        .where({ project_id: projectId })
        .orderBy([
          { column: "kind", order: "desc" }, // "main" sorts after "change_order" alphabetically; desc puts it first
          { column: "created_at", order: "asc" },
        ]);
    },

    findById(id: string): Promise<ContractRow | undefined> {
      return db<ContractRow>("project_contracts").where({ id }).first();
    },

    findMain(projectId: string): Promise<ContractRow | undefined> {
      return db<ContractRow>("project_contracts").where({ project_id: projectId, kind: "main" }).first();
    },

    findByChangeRequest(changeRequestId: string): Promise<ContractRow | undefined> {
      return db<ContractRow>("project_contracts").where({ change_request_id: changeRequestId }).first();
    },

    listByChangeRequests(changeRequestIds: string[]): Promise<ContractRow[]> {
      if (changeRequestIds.length === 0) return Promise.resolve([]);
      return db<ContractRow>("project_contracts").whereIn("change_request_id", changeRequestIds);
    },

    async create(record: NewContractRecord): Promise<ContractRow> {
      const [row] = await db<ContractRow>("project_contracts").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert contract");
      return row;
    },

    /**
     * Inserts the main contract unless one already exists — two first reads
     * racing each other must not create two mains (the partial unique index
     * backs this up).
     */
    async createMainIfMissing(record: NewContractRecord): Promise<ContractRow> {
      await db("project_contracts")
        .insert(record)
        .onConflict(db.raw("(project_id) WHERE kind = 'main'"))
        .ignore();
      const row = await this.findMain(record.project_id);
      if (!row) throw new Error("Failed to materialise the main contract");
      return row;
    },

    async update(id: string, patch: ContractUpdatePatch): Promise<ContractRow | undefined> {
      const [row] = await db<ContractRow>("project_contracts")
        .where({ id })
        .update({ ...patch, updated_at: db.fn.now() })
        .returning("*");
      return row;
    },

    async remove(id: string): Promise<void> {
      await db("project_contracts").where({ id }).del();
    },
  };
}

export type ContractsRepository = ReturnType<typeof contractsRepository>;
