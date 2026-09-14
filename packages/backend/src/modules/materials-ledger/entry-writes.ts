import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import type { LedgerEntryRow, PostEntryInput, PostEntryResult } from "./types.ts";

/**
 * The two writes that move stock. Both run in one transaction and lock the
 * stock row FOR UPDATE, so a concurrent receipt and issue on the same material
 * can never lose an update. They live apart from the reads because this is
 * where the ledger's invariants are enforced.
 */
export function ledgerWrites(db: Knex) {
  return {
  async approveEntry(
    projectId: string,
    entryId: string,
    actorId: string,
  ): Promise<LedgerEntryRow | null> {
    return db.transaction(async (trx) => {
      const entry = await trx<LedgerEntryRow>("material_ledger_entries")
        .where({ id: entryId, project_id: projectId })
        .first();
      if (!entry) return null;
      // Idempotent: approving twice must not apply the delta twice.
      if (entry.approval_status === "Approved") return entry;

      const locked = await trx("materials_stock")
        .where({
          project_id: projectId,
          material_id: entry.material_id,
          location_key: entry.location_key,
        })
        .forUpdate()
        .first<{ on_hand_qty: string }>();
      const nextOnHand = (locked ? Number(locked.on_hand_qty) : 0) + Number(entry.stock_delta);

      await trx("material_ledger_entries").where({ id: entryId }).update({
        approval_status: "Approved",
        approved_by_id: actorId,
        approved_at: trx.fn.now(),
        // Maker/checker is the point of approval; approving your own entry
        // is allowed on a small site team but must be visible.
        self_approved: entry.logged_by_id === actorId,
        // Only knowable now: the shortfall depends on the balance at the
        // moment the movement is accepted, not when it was claimed.
        negative_stock: nextOnHand < 0,
        updated_at: trx.fn.now(),
      });

      await trx("materials_stock")
        .where({
          project_id: projectId,
          material_id: entry.material_id,
          location_key: entry.location_key,
        })
        .update({
          on_hand_qty: nextOnHand,
          last_ledger_entry_id: entryId,
          updated_at: trx.fn.now(),
        });

      // The flag says "this material is short", not "it was short once".
      // Once the balance is back above zero the earlier warnings are stale,
      // so they are cleared rather than left to contradict the stock page.
      if (nextOnHand >= 0) {
        await trx("material_ledger_entries")
          .where({
            project_id: projectId,
            material_id: entry.material_id,
            location_key: entry.location_key,
            negative_stock: true,
          })
          .update({ negative_stock: false, updated_at: trx.fn.now() });
      }

      return { ...entry, approval_status: "Approved" };
    });
  },

  async postEntry(input: PostEntryInput): Promise<PostEntryResult> {
    return db.transaction(async (trx) => {
      const existing = await trx<LedgerEntryRow>("material_ledger_entries")
        .where({ project_id: input.projectId, idempotency_key: input.idempotencyKey })
        .first();
      if (existing) {
        const stockRow = await trx<{ on_hand_qty: string }>("materials_stock")
          .where({ project_id: input.projectId, material_id: existing.material_id, location_key: existing.location_key })
          .first();
        return {
          entryId: existing.id,
          duplicate: true,
          negativeStock: existing.negative_stock,
          onHandQty: stockRow ? Number(stockRow.on_hand_qty) : 0,
        };
      }

      await trx("materials_stock")
        .insert({
          project_id: input.projectId,
          material_id: input.materialId,
          location_key: input.locationKey,
          on_hand_qty: 0,
        })
        .onConflict(["project_id", "material_id", "location_key"])
        .ignore();

      const locked = await trx("materials_stock")
        .where({ project_id: input.projectId, material_id: input.materialId, location_key: input.locationKey })
        .forUpdate()
        .first<{ on_hand_qty: string }>();
        const current = locked ? Number(locked.on_hand_qty) : 0;
        // A pending entry is a claim, not yet a fact. It must not move stock
        // and must not raise a negative-stock flag for a movement that has
        // not been accepted. approve() applies the delta later.
        const gated = input.approvalStatus === "Pending";
        const nextOnHand = gated ? current : current + input.stockDelta;
        const negativeStock = nextOnHand < 0;

      await trx("material_ledger_entries").insert({
        id: input.id,
        project_id: input.projectId,
        idempotency_key: input.idempotencyKey,
          entry_type: input.entryType,
          status: "Posted",
          approval_status: input.approvalStatus,
        material_id: input.materialId,
        material_name_snapshot: input.materialName,
        stage_id: input.stageId,
        unit_snapshot: input.unit,
        location_key: input.locationKey,
        quantity: input.quantity,
        stock_delta: input.stockDelta,
        occurred_at: input.occurredAt,
        timestamp_suspect: input.timestampSuspect,
        negative_stock: negativeStock,
        logged_by_id: input.loggedById,
        material_order_id: input.materialOrderId,
        task_id: input.taskId,
        activity_id: input.activityId,
        reversal_for_entry_id: input.reversalForEntryId,
        reason: input.reason,
        notes_html: input.notesHtml,
        supplier: input.supplier,
        delivery_note: input.deliveryNote,
      });

        if (!gated) {
          await trx("materials_stock")
            .where({ project_id: input.projectId, material_id: input.materialId, location_key: input.locationKey })
            .update({ on_hand_qty: nextOnHand, last_ledger_entry_id: input.id, updated_at: trx.fn.now() });
        }

      if (input.reversalForEntryId) {
        await trx("material_ledger_entries")
          .where({ id: input.reversalForEntryId })
          .update({ status: "Voided", updated_at: trx.fn.now() });
      }

      if (input.fileIds.length > 0) {
        await trx("material_ledger_entry_files").insert(
          input.fileIds.map((fileId) => ({ entry_id: input.id, file_id: fileId, purpose: "ProofPhoto" })),
        );
      }

      await trx("material_ledger_entry_events").insert({
        id: generateId("mlev"),
        project_id: input.projectId,
        entry_id: input.id,
        event_type: input.entryType === "VOID" ? "voided" : "created",
        actor_id: input.actorId,
        detail: JSON.stringify({ entryType: input.entryType, stockDelta: input.stockDelta }),
      });

      return { entryId: input.id, duplicate: false, negativeStock, onHandQty: nextOnHand };
    });
  },
  };
}
