import type { Knex } from "knex";

/**
 * Two voided material movements, because a void is the case the ledger exists
 * for and the demo could not show one.
 *
 * Shaped exactly the way `materials-ledger/service.ts voidEntry` and
 * `entry-writes.ts postEntry` write it, because the assistant, the stock
 * arithmetic and the ledger UI all read that shape: the original row stays on
 * the ledger with `status = 'Voided'`, and a separate VOID entry is posted
 * against it carrying `reversal_for_entry_id`, the reason, the person who
 * voided it and a reversing `stock_delta`. Nothing is deleted — a void is a
 * record, not a correction of history.
 *
 * Each case is a self-contained pair that nets to zero on stock: the movement
 * applied its delta, the reversal took it straight back out. So
 * `materials_stock.on_hand_qty`, which 20260775_marbella_modern.ts owns, is
 * left exactly as it was, and `received - used = on hand` still holds once
 * voided quantities drop out of both totals — which is the invariant the
 * `listStock` fix restored.
 */

const PROJECT_ID = "sample-project";

/** Every row this seed owns. The delete pass matches on it and nothing else. */
const ID_PREFIX = "mle-vd-";

interface VoidCase {
  key: string;
  /** Matched against materials_catalog.normalized_name, which 20260775 writes as the lowercased name. */
  materialName: string;
  unit: string;
  entryType: "IN" | "USED";
  quantity: number;
  /** Days before now that the movement happened. */
  occurredDaysAgo: number;
  /** Days before now that it was voided. Always later than the movement. */
  voidedDaysAgo: number;
  supplier: string | null;
  deliveryNote: string | null;
  reason: string;
  voidReason: string;
  /** Demo account that logged the movement / posted the void, when no real account exists. */
  loggedByDemoId: string;
  voidedByDemoId: string;
  activityId: string | null;
  notesHtml: string | null;
}

/**
 * Case one is the common one: a receipt typed onto the wrong catalogue line
 * and caught the next morning. Kolo Aggregates delivered on one note and the
 * storekeeper booked it twice over — once correctly under Sharp sand (the
 * 40-tonne IN that 20260775 already seeds) and once against granite.
 *
 * Case two moves stock the other way: bars issued to the gang, then returned
 * to the lock-up unused after RFI 1 revised the hoop spacing on SD-04 rev C,
 * so the issue is voided and the 18 lengths go back on hand. Its void sits a
 * week after the movement and behind the whole 6-days-ago usage batch, so the
 * reversal lands on the first page of the ledger while the entry it reverses
 * does not — the split `materialLedgerReversalsFor` batches for.
 */
const VOID_CASES: VoidCase[] = [
  {
    key: "granite-misbooked",
    materialName: "Granite chippings 3/4",
    unit: "tonne",
    entryType: "IN",
    quantity: 40,
    occurredDaysAgo: 13,
    voidedDaysAgo: 12,
    supplier: "Kolo Aggregates",
    deliveryNote: "AGG-2026-064",
    reason: "Tipped at the aggregate bay off the Mowe-Ibafo truck",
    voidReason:
      "Booked against the wrong material — delivery note AGG-2026-064 was 40 tonnes of sharp sand, not granite chippings. The sand entry on the same note is the correct one; this line is reversed in full.",
    loggedByDemoId: "usr_demo_pm",
    voidedByDemoId: "usr_demo_qs",
    activityId: null,
    notesHtml: "<p>Weighbridge ticket stapled to the note. Tipped beside the granite bay, which is how the line got picked.</p>",
  },
  {
    key: "rebar16-returned",
    materialName: "Reinforcement steel 16mm (12m)",
    unit: "length",
    entryType: "USED",
    quantity: 18,
    occurredDaysAgo: 9,
    voidedDaysAgo: 1,
    supplier: null,
    deliveryNote: null,
    reason: "Issued to the steel-fixing gang for the first-floor column cages",
    voidReason:
      "Came back to store unused. SD-04 rev C cut the hoop count at grid B-3, so the gang never cut these 18 lengths — they sat in the lock-up and were counted back in at the month-end stock take.",
    loggedByDemoId: "usr_demo_pm",
    voidedByDemoId: "usr_demo_engineer",
    activityId: "act-2",
    notesHtml: null,
  },
];

interface CatalogRow {
  id: string;
  name: string;
  unit: string;
}

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;
  if (!(await knex.schema.hasTable("material_ledger_entries"))) return;

  // logged_by_id is a hard FK onto `user`. A developer's own account wins so
  // the void reads as something a real person on this workspace did; the demo
  // identities from 20260100_demo_identity.ts only stand in on a database
  // nobody has signed up to, and that file no-ops the moment a real workspace
  // exists, so neither side can be assumed present.
  const realUser = await knex("user")
    .whereNot("id", "like", "demo_metrics_%")
    .whereNot("id", "like", "usr_demo_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string }>("id");
  const demoIds = await knex("user")
    .where("id", "like", "usr_demo_%")
    .pluck<string[]>("id");
  const actorFor = (demoId: string): string | null =>
    realUser?.id ?? (demoIds.includes(demoId) ? demoId : null);

  const hasApprovalStatus = await knex.schema.hasColumn("material_ledger_entries", "approval_status");
  const hasStage = await knex.schema.hasColumn("material_ledger_entries", "stage_id");
  const hasSupplier = await knex.schema.hasColumn("material_ledger_entries", "supplier");
  const hasNotesHtml = await knex.schema.hasColumn("material_ledger_entries", "notes_html");

  // stage_id and activity_id are FKs onto rows another seed owns, so they are
  // resolved rather than assumed: a schema without the shell phase should lose
  // the link, not the void.
  const shellPhase = await knex("project_phases")
    .where({ id: "p2", project_id: PROJECT_ID })
    .first<{ id: string }>("id");
  const activityIds = await knex("activities").where({ project_id: PROJECT_ID }).pluck<string[]>("id");

  const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const money = (n: number) => n.toFixed(2);

  const originalId = (key: string) => `${ID_PREFIX}${key}-movement`;
  const reversalId = (key: string) => `${ID_PREFIX}${key}-reversal`;

  // Reversals first: reversal_for_entry_id is ON DELETE RESTRICT, so a single
  // statement covering both sides would be refused by the entry it points at.
  await knex("material_ledger_entries")
    .where({ project_id: PROJECT_ID })
    .whereIn("id", VOID_CASES.map((c) => reversalId(c.key)))
    .del();
  await knex("material_ledger_entries")
    .where({ project_id: PROJECT_ID })
    .whereIn("id", VOID_CASES.map((c) => originalId(c.key)))
    .del();

  const catalog = await knex("materials_catalog")
    .where({ project_id: PROJECT_ID })
    .select<CatalogRow[]>("id", "name", "unit");
  const byNormalized = new Map(catalog.map((row) => [row.name.trim().toLowerCase(), row]));

  const entries: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const seeded: string[] = [];

  for (const kase of VOID_CASES) {
    const material = byNormalized.get(kase.materialName.trim().toLowerCase());
    // The catalogue is 20260775's; if a material was renamed there, skip the
    // case rather than invent a catalogue row and a stock balance to go with it.
    if (!material) continue;

    const loggedBy = actorFor(kase.loggedByDemoId);
    const voidedBy = actorFor(kase.voidedByDemoId);
    const delta = kase.entryType === "IN" ? kase.quantity : -kase.quantity;
    const activityId = kase.activityId && activityIds.includes(kase.activityId) ? kase.activityId : null;

    const shared = {
      project_id: PROJECT_ID,
      material_id: material.id,
      material_name_snapshot: material.name,
      unit_snapshot: material.unit,
      location_key: "default",
      timestamp_suspect: false,
      // Neither movement drives a balance below zero: the granite receipt is
      // positive, and 18 of 120 lengths were on hand when the bars went out.
      negative_stock: false,
      material_order_id: null,
      task_id: null,
      ...(hasStage ? { stage_id: shellPhase?.id ?? null } : {}),
      ...(hasApprovalStatus ? { approval_status: "Approved" } : {}),
      ...(hasSupplier ? { supplier: kase.supplier, delivery_note: kase.deliveryNote } : {}),
    };

    entries.push({
      ...shared,
      id: originalId(kase.key),
      idempotency_key: `demo-void-${kase.key}-movement`,
      entry_type: kase.entryType,
      // The row stays on the ledger carrying the flag, exactly as voidEntry
      // leaves it. Nothing about the original is rewritten but its status.
      status: "Voided",
      quantity: money(kase.quantity),
      stock_delta: money(delta),
      occurred_at: iso(kase.occurredDaysAgo),
      logged_by_id: loggedBy,
      activity_id: activityId,
      reversal_for_entry_id: null,
      reason: kase.reason,
      ...(hasNotesHtml ? { notes_html: kase.notesHtml } : {}),
    });

    entries.push({
      ...shared,
      id: reversalId(kase.key),
      idempotency_key: `demo-void-${kase.key}-reversal`,
      entry_type: "VOID",
      // The reversal itself is a live, posted movement — it is what took the
      // quantity back out of stock, so it is never 'Voided' in its own right.
      status: "Posted",
      quantity: money(kase.quantity),
      stock_delta: money(-delta),
      occurred_at: iso(kase.voidedDaysAgo),
      logged_by_id: voidedBy,
      // voidEntry carries none of the movement's programme links onto the
      // reversal: undoing a booking is not itself work on an activity.
      activity_id: null,
      reversal_for_entry_id: originalId(kase.key),
      reason: kase.voidReason,
      ...(hasNotesHtml ? { notes_html: null } : {}),
    });

    events.push({
      id: `mlev-vd-${kase.key}-movement`,
      project_id: PROJECT_ID,
      entry_id: originalId(kase.key),
      event_type: "created",
      actor_id: loggedBy,
      detail: JSON.stringify({ entryType: kase.entryType, stockDelta: delta }),
      created_at: iso(kase.occurredDaysAgo),
    });
    events.push({
      id: `mlev-vd-${kase.key}-reversal`,
      project_id: PROJECT_ID,
      entry_id: reversalId(kase.key),
      event_type: "voided",
      actor_id: voidedBy,
      detail: JSON.stringify({ entryType: "VOID", stockDelta: -delta }),
      created_at: iso(kase.voidedDaysAgo),
    });
    seeded.push(kase.key);
  }

  if (entries.length === 0) return;
  await knex("material_ledger_entries").insert(entries);

  if (await knex.schema.hasTable("material_ledger_entry_events")) {
    // 20260795 derives one event per ledger entry and runs before this file,
    // so on a re-run it has already written a generic event for these four.
    // Clearing by entry keeps the audit trail at one event per entry instead
    // of two saying the same thing.
    await knex("material_ledger_entry_events")
      .whereIn("entry_id", entries.map((entry) => entry["id"] as string))
      .del();
    await knex("material_ledger_entry_events").insert(events);
  }
}
