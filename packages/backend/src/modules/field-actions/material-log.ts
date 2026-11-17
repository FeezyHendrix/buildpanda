import type { Knex } from "knex";
import { BadRequestError } from "../../lib/errors.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import { buildMaterialsLedgerService } from "../materials-ledger/wiring.ts";
import { authorizeMaterialLogScope } from "./material-log-authorization.ts";
import { validateMaterialLogCommand } from "./material-log-validation.ts";
import type { MaterialLogActionResult, MaterialLogCommand, MaterialLogExecutionDeps } from "./material-types.ts";
import type { FieldActor } from "./types.ts";

export { validateMaterialLogCommand } from "./material-log-validation.ts";

export function createMaterialLedgerExecutor(deps: MaterialLogExecutionDeps) {
  return {
    async execute(input: MaterialLogCommand, actor: FieldActor): Promise<MaterialLogActionResult> {
      const command = validateMaterialLogCommand(input);
      if (!command.payload.idempotencyKey?.trim()) throw new BadRequestError("The material action needs a stable idempotency key");
      const scope = await deps.authorize(actor, command.projectId, command.payload.entryType);
      const result = await deps.ledger.logEntry(command.projectId, command.payload, scope.actor.id);
      return { kind: "material_log", projectId: command.projectId, recordId: result.entry.id,
        entryType: command.payload.entryType, materialName: result.entry.materialName, quantity: result.entry.quantity,
        unit: result.entry.unit, onHandQty: result.onHandQty, duplicate: result.duplicate };
    },
  };
}

function transactionalExecutor(db: Knex, queue?: QueueManager) {
  return createMaterialLedgerExecutor({
    authorize: (actor, projectId, entryType) => authorizeMaterialLogScope(db, actor, projectId, entryType),
    ledger: buildMaterialsLedgerService(db, queue),
  });
}

/** The caller's transaction includes the stock entry and its confirmed action receipt. */
export function materialLedgerExecutor(db: Knex, queue?: QueueManager) {
  return {
    execute(input: MaterialLogCommand, actor: FieldActor): Promise<MaterialLogActionResult> {
      return db.isTransaction ? transactionalExecutor(db, queue).execute(input, actor)
        : db.transaction((transaction) => transactionalExecutor(transaction, queue).execute(input, actor));
    },
  };
}
