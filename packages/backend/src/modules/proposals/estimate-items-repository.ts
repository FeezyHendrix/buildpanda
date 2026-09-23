import { assertTransaction, type EstimateDb } from "./estimate-db.ts";
import type {
  CreateEstimateItemInput,
  CreatePaymentScheduleInput,
  EstimateItem,
  EstimateItemRow,
  PaymentScheduleItem,
  PaymentScheduleRow,
} from "./types.ts";

function toEstimateItem(row: EstimateItemRow): EstimateItem {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    groupLabel: row.group_label,
    description: row.description,
    descriptionHtml: row.description_html,
    qty: Number(row.qty),
    unit: row.unit,
    unitRate: Number(row.unit_rate),
    total: Number(row.total),
    boqItemId: row.boq_item_id,
    takeoffSessionId: row.takeoff_session_id ?? null,
    sort: row.sort,
  };
}

function toScheduleItem(row: PaymentScheduleRow): PaymentScheduleItem {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    label: row.label,
    percent: Number(row.percent),
    description: row.description,
    descriptionHtml: row.description_html,
    sort: row.sort,
    kind: row.kind ?? "stage",
    programmeTaskId: row.programme_task_id ?? null,
  };
}

// Calculate denormalized estimate totals from items
function calcTotals(
  items: Pick<EstimateItem, "qty" | "unitRate">[],
  contingencyPct: number,
  taxPct: number,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitRate, 0);
  const contingencyAmount = subtotal * (contingencyPct / 100);
  const taxableBase = subtotal + contingencyAmount;
  const taxAmount = taxableBase * (taxPct / 100);
  const total = taxableBase + taxAmount;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export type EstimateItemsRepository = ReturnType<typeof estimateItemsRepository>;

// The priced lines of an estimate and the payment schedule drawn off them,
// plus the denormalized totals they roll up into.
export function estimateItemsRepository(db: EstimateDb) {
  async function recalcTotals(estimateId: string, contingencyPct: number, taxPct: number): Promise<void> {
    const items = await db<EstimateItemRow>("estimate_items")
      .where({ estimate_id: estimateId })
      .select("qty", "unit_rate");
    const { subtotal, taxAmount, total } = calcTotals(
      items.map((i) => ({ qty: Number(i.qty), unitRate: Number(i.unit_rate) })),
      contingencyPct,
      taxPct,
    );
    await db("estimates").where({ id: estimateId }).update({ subtotal, tax_amount: taxAmount, total });
  }

  // --- Items ---

  async function getItems(estimateId: string): Promise<EstimateItem[]> {
    const rows = await db<EstimateItemRow>("estimate_items")
      .where({ estimate_id: estimateId })
      .orderBy("sort", "asc");
    return rows.map(toEstimateItem);
  }

  // Runs on the caller's transaction rather than opening its own: the totals
  // recalculated straight after this are part of the same fact, and a nested
  // transaction would commit these rows on a second connection where a failing
  // recalcTotals could no longer roll them back.
  async function replaceItems(estimateId: string, items: CreateEstimateItemInput[], ids: string[]): Promise<EstimateItem[]> {
    const trx = assertTransaction(db, "replaceItems");
    await trx("estimate_items").where({ estimate_id: estimateId }).del();
    if (items.length > 0) {
      await trx("estimate_items").insert(
        items.map((item, i) => ({
          id: ids[i],
          estimate_id: estimateId,
          group_label: item.groupLabel,
          description: item.description,
          description_html: item.descriptionHtml ?? null,
          qty: item.qty,
          unit: item.unit,
          unit_rate: item.unitRate,
          total: Math.round(item.qty * item.unitRate * 100) / 100,
          boq_item_id: item.boqItemId ?? null,
          takeoff_session_id: item.takeoffSessionId ?? null,
          sort: item.sort ?? i,
        })),
      );
    }
    const rows = await trx<EstimateItemRow>("estimate_items")
      .where({ estimate_id: estimateId })
      .orderBy("sort", "asc");
    return rows.map(toEstimateItem);
  }

  // --- Payment schedule ---

  async function getSchedule(estimateId: string): Promise<PaymentScheduleItem[]> {
    const rows = await db<PaymentScheduleRow>("estimate_payment_schedule")
      .where({ estimate_id: estimateId })
      .orderBy("sort", "asc");
    return rows.map(toScheduleItem);
  }

  async function replaceSchedule(
    estimateId: string,
    items: CreatePaymentScheduleInput[],
    ids: string[],
  ): Promise<PaymentScheduleItem[]> {
    const trx = assertTransaction(db, "replaceSchedule");
    await trx("estimate_payment_schedule").where({ estimate_id: estimateId }).del();
    if (items.length > 0) {
      await trx("estimate_payment_schedule").insert(
        items.map((item, i) => ({
          id: ids[i],
          estimate_id: estimateId,
          label: item.label,
          percent: item.percent,
          description: item.description ?? null,
          description_html: item.descriptionHtml ?? null,
          sort: item.sort ?? i,
          kind: item.kind ?? "stage",
          programme_task_id: item.programmeTaskId ?? null,
        })),
      );
    }
    const rows = await trx<PaymentScheduleRow>("estimate_payment_schedule")
      .where({ estimate_id: estimateId })
      .orderBy("sort", "asc");
    return rows.map(toScheduleItem);
  }

  return { recalcTotals, getItems, replaceItems, getSchedule, replaceSchedule };
}
