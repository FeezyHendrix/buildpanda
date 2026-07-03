import type { Knex } from "knex";
import type { SelectionOptionRow, SelectionRow, SelectionStatus } from "./types.ts";

export interface NewSelectionRecord {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string | null;
  allowance_amount: string | null;
  currency: string;
  due_date: string | null;
  status: SelectionStatus;
  created_by_id: string | null;
}

export interface NewSelectionOptionRecord {
  id: string;
  selection_id: string;
  name: string;
  description: string | null;
  price: string | null;
  sort_order: number;
}

export interface SelectionUpdatePatch {
  title?: string;
  description?: string | null;
  category?: string | null;
  allowance_amount?: string | null;
  currency?: string;
  due_date?: string | null;
  status?: SelectionStatus;
  chosen_option_id?: string | null;
  decided_by_id?: string | null;
  decided_at?: string | null;
  change_request_id?: string | null;
  // Decision-chasing reminder state (see lifecycle/decision-chasing-job.ts).
  reminder_level?: number | null;
  last_reminded_at?: string | null;
  updated_at?: string;
}

const SELECT = [
  "s.id",
  "s.project_id",
  "s.title",
  "s.description",
  "s.category",
  "s.allowance_amount",
  "s.currency",
  "s.due_date",
  "s.status",
  "s.chosen_option_id",
  "s.decided_by_id",
  "u.name as decided_by_name",
  "s.decided_at",
  "s.change_request_id",
  "s.created_by_id",
  "s.created_at",
  "s.updated_at",
] as const;

export function selectionsRepository(db: Knex) {
  function base() {
    return db("project_selections as s").leftJoin("user as u", "u.id", "s.decided_by_id");
  }

  return {
    listByProject(projectId: string, status?: SelectionStatus): Promise<SelectionRow[]> {
      const q = base().where("s.project_id", projectId);
      if (status) q.andWhere("s.status", status);
      return q.select(...SELECT).orderBy("s.created_at", "desc");
    },

    findById(id: string): Promise<SelectionRow | undefined> {
      return base().where("s.id", id).select(...SELECT).first();
    },

    // Batched: one whereIn for the whole list (no query per selection).
    optionsForSelections(selectionIds: string[]): Promise<SelectionOptionRow[]> {
      if (selectionIds.length === 0) return Promise.resolve([]);
      return db<SelectionOptionRow>("project_selection_options")
        .whereIn("selection_id", selectionIds)
        .orderBy([
          { column: "sort_order", order: "asc" },
          { column: "created_at", order: "asc" },
        ]);
    },

    optionById(id: string): Promise<SelectionOptionRow | undefined> {
      return db<SelectionOptionRow>("project_selection_options").where({ id }).first();
    },

    async create(
      record: NewSelectionRecord,
      options: NewSelectionOptionRecord[],
    ): Promise<SelectionRow> {
      await db.transaction(async (trx) => {
        await trx("project_selections").insert(record);
        if (options.length > 0) await trx("project_selection_options").insert(options);
      });
      const row = await this.findById(record.id);
      if (!row) throw new Error("Failed to insert selection");
      return row;
    },

    async update(id: string, patch: SelectionUpdatePatch): Promise<SelectionRow | undefined> {
      await db("project_selections").where({ id }).update(patch);
      return this.findById(id);
    },

    async replaceOptions(
      selectionId: string,
      options: NewSelectionOptionRecord[],
    ): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("project_selection_options").where({ selection_id: selectionId }).del();
        if (options.length > 0) await trx("project_selection_options").insert(options);
      });
    },

    async remove(id: string): Promise<void> {
      await db("project_selections").where({ id }).del();
    },

    /** User ids of active client participants — the people who make selections. */
    activeClientUserIds(projectId: string): Promise<string[]> {
      return db("project_participants")
        .where({ project_id: projectId, role: "client", status: "active" })
        .whereNotNull("user_id")
        .pluck("user_id");
    },
  };
}

export type SelectionsRepository = ReturnType<typeof selectionsRepository>;
