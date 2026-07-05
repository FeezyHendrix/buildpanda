import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { ChangeRequestsService } from "../change-requests/service.ts";
import type {
  NewSelectionOptionRecord,
  SelectionsRepository,
  SelectionUpdatePatch,
} from "./repository.ts";
import type {
  Currency,
  Selection,
  SelectionOption,
  SelectionOptionRow,
  SelectionRow,
} from "./types.ts";

export interface SelectionOptionInput {
  name: string;
  description?: string | null;
  price?: number | null;
}

export interface CreateSelectionInput {
  title: string;
  description?: string | null;
  category?: string | null;
  allowanceAmount?: number | null;
  currency?: Currency;
  dueDate?: string | null;
  options?: SelectionOptionInput[];
}

export interface UpdateSelectionInput {
  title?: string;
  description?: string | null;
  category?: string | null;
  allowanceAmount?: number | null;
  currency?: Currency;
  dueDate?: string | null;
  status?: "open" | "cancelled";
  options?: SelectionOptionInput[];
}

export interface SelectionsDeps {
  notifications?: NotificationsService;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toOption(row: SelectionOptionRow): SelectionOption {
  return {
    id: row.id,
    selectionId: row.selection_id,
    name: row.name,
    description: row.description,
    price: row.price === null ? null : Number(row.price),
    sortOrder: row.sort_order,
  };
}

function computeOverage(row: SelectionRow, options: SelectionOption[]): number | null {
  if (row.allowance_amount === null || row.chosen_option_id === null) return null;
  const chosen = options.find((o) => o.id === row.chosen_option_id);
  if (!chosen || chosen.price === null) return null;
  return Math.max(0, round2(chosen.price - Number(row.allowance_amount)));
}

function toSelection(row: SelectionRow, optionRows: SelectionOptionRow[]): Selection {
  const options = optionRows.map(toOption);
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    category: row.category,
    allowanceAmount: row.allowance_amount === null ? null : Number(row.allowance_amount),
    currency: row.currency,
    dueDate: row.due_date,
    status: row.status,
    chosenOptionId: row.chosen_option_id,
    decidedById: row.decided_by_id,
    decidedByName: row.decided_by_name,
    decidedAt: row.decided_at,
    changeRequestId: row.change_request_id,
    createdById: row.created_by_id,
    overage: computeOverage(row, options),
    options,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOptionRecords(
  selectionId: string,
  inputs: SelectionOptionInput[],
): NewSelectionOptionRecord[] {
  return inputs.map((o, index) => ({
    id: generateId("selo"),
    selection_id: selectionId,
    name: o.name,
    description: o.description ?? null,
    price: o.price === undefined || o.price === null ? null : String(o.price),
    sort_order: index,
  }));
}

/** Fire-and-forget: a selection awaits the homeowner's decision. */
function notifySelectionOpen(
  deps: SelectionsDeps,
  clientUserIds: string[],
  projectId: string,
  title: string,
  actorId: string,
): void {
  if (!deps.notifications) return;
  for (const userId of clientUserIds) {
    if (userId === actorId) continue;
    void deps.notifications
      .notify(userId, "selection_created", {
        title: "A selection needs your decision",
        body: title,
        projectId,
      })
      .catch(() => undefined);
  }
}

/** Fire-and-forget: tell the company side the client has chosen. */
function notifySelectionDecided(
  deps: SelectionsDeps,
  creatorId: string | null,
  projectId: string,
  title: string,
  actorId: string,
): void {
  if (!deps.notifications || !creatorId || creatorId === actorId) return;
  void deps.notifications
    .notify(creatorId, "selection_decided", {
      title: "A selection was decided",
      body: title,
      projectId,
    })
    .catch(() => undefined);
}

export function selectionsService(repository: SelectionsRepository, deps: SelectionsDeps = {}) {
  async function loadSelection(projectId: string, selectionId: string): Promise<SelectionRow> {
    const row = await repository.findById(selectionId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Selection");
    return row;
  }

  async function withOptions(row: SelectionRow): Promise<Selection> {
    const options = await repository.optionsForSelections([row.id]);
    return toSelection(row, options);
  }

  return {
    async list(projectId: string, status?: Selection["status"]): Promise<Selection[]> {
      const rows = await repository.listByProject(projectId, status);
      const options = await repository.optionsForSelections(rows.map((r) => r.id));
      const bySelection = new Map<string, SelectionOptionRow[]>();
      for (const o of options) {
        const list = bySelection.get(o.selection_id) ?? [];
        list.push(o);
        bySelection.set(o.selection_id, list);
      }
      return rows.map((r) => toSelection(r, bySelection.get(r.id) ?? []));
    },

    async get(projectId: string, selectionId: string): Promise<Selection> {
      return withOptions(await loadSelection(projectId, selectionId));
    },

    async create(
      projectId: string,
      input: CreateSelectionInput,
      userId: string,
      projectCurrency: Currency,
    ): Promise<Selection> {
      const id = generateId("sel");
      const row = await repository.create(
        {
          id,
          project_id: projectId,
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? null,
          allowance_amount:
            input.allowanceAmount === undefined || input.allowanceAmount === null
              ? null
              : String(input.allowanceAmount),
          currency: input.currency ?? projectCurrency,
          due_date: input.dueDate ?? null,
          status: "open",
          created_by_id: userId,
        },
        toOptionRecords(id, input.options ?? []),
      );
      const clientIds = await repository.activeClientUserIds(projectId);
      notifySelectionOpen(deps, clientIds, projectId, row.title, userId);
      return withOptions(row);
    },

    async update(
      projectId: string,
      selectionId: string,
      input: UpdateSelectionInput,
      userId: string,
    ): Promise<Selection> {
      const existing = await loadSelection(projectId, selectionId);

      const patch: SelectionUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.category !== undefined) patch.category = input.category;
      if (input.allowanceAmount !== undefined) {
        patch.allowance_amount =
          input.allowanceAmount === null ? null : String(input.allowanceAmount);
      }
      if (input.currency !== undefined) patch.currency = input.currency;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;

      const reopened = input.status === "open" && existing.status !== "open";
      if (input.status !== undefined) {
        patch.status = input.status;
        if (reopened) {
          // Reopening clears the previous decision so the client can choose again,
          // and resets reminder state so decision chasing starts from level one.
          patch.chosen_option_id = null;
          patch.decided_by_id = null;
          patch.decided_at = null;
          patch.reminder_level = null;
          patch.last_reminded_at = null;
        }
      }

      if (input.options !== undefined) {
        const openAfterUpdate = input.status === "open" || (input.status === undefined && existing.status === "open");
        if (!openAfterUpdate) {
          throw new BadRequestError("Options can only be edited while the selection is open");
        }
        // Replacing options invalidates any previously chosen option id.
        if (existing.chosen_option_id !== null) patch.chosen_option_id = null;
        await repository.replaceOptions(selectionId, toOptionRecords(selectionId, input.options));
      }

      const updated = await repository.update(selectionId, patch);
      if (!updated) throw new NotFoundError("Selection");
      if (reopened) {
        const clientIds = await repository.activeClientUserIds(projectId);
        notifySelectionOpen(deps, clientIds, projectId, updated.title, userId);
      }
      return withOptions(updated);
    },

    async decide(
      projectId: string,
      selectionId: string,
      optionId: string,
      userId: string,
    ): Promise<Selection> {
      const existing = await loadSelection(projectId, selectionId);
      if (existing.status !== "open") {
        throw new BadRequestError("Only open selections can be decided");
      }
      const option = await repository.optionById(optionId);
      if (!option || option.selection_id !== selectionId) throw new NotFoundError("Option");

      const updated = await repository.update(selectionId, {
        status: "decided",
        chosen_option_id: option.id,
        decided_by_id: userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (!updated) throw new NotFoundError("Selection");
      notifySelectionDecided(deps, existing.created_by_id, projectId, existing.title, userId);
      return withOptions(updated);
    },

    /**
     * Turns the over-allowance amount of a decided selection into a change
     * request via the change-requests SERVICE (its rules travel with it).
     */
    async createChangeRequest(
      projectId: string,
      selectionId: string,
      userId: string,
      changeRequests: ChangeRequestsService,
    ): Promise<Selection> {
      const existing = await loadSelection(projectId, selectionId);
      if (existing.status !== "decided" || existing.chosen_option_id === null) {
        throw new BadRequestError("Only decided selections can create a change request");
      }
      if (existing.change_request_id !== null) {
        throw new BadRequestError("A change request already exists for this selection");
      }
      const option = await repository.optionById(existing.chosen_option_id);
      if (!option) throw new NotFoundError("Option");
      if (option.price === null || existing.allowance_amount === null) {
        throw new BadRequestError("The selection needs both an allowance and a chosen option price");
      }
      const overage = round2(Number(option.price) - Number(existing.allowance_amount));
      if (overage <= 0) {
        throw new BadRequestError("The chosen option is within the allowance");
      }

      const changeRequest = await changeRequests.create(
        projectId,
        {
          title: `Selection overage: ${existing.title}`,
          description: `Chosen option "${option.name}" exceeds the ${existing.title} allowance.`,
          reason: "Selection above allowance",
          costImpact: overage,
          currency: existing.currency,
        },
        userId,
      );

      const updated = await repository.update(selectionId, {
        change_request_id: changeRequest.id,
        updated_at: new Date().toISOString(),
      });
      if (!updated) throw new NotFoundError("Selection");
      return withOptions(updated);
    },

    async remove(projectId: string, selectionId: string): Promise<void> {
      await loadSelection(projectId, selectionId);
      await repository.remove(selectionId);
    },
  };
}

export type SelectionsService = ReturnType<typeof selectionsService>;
