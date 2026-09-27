import type { Knex } from "knex";

/**
 * Materials assurance and inspection reference data for the Sample Project.
 *
 * Runs after 20260530_marbella.ts and 20260775_marbella_modern.ts, which own
 * the catalogue, the stock figures, the orders, the suppliers and the
 * inspections. Nothing here re-states a quantity those seeds already asserted:
 * goods-received events are written against the two real orders only, and the
 * ledger audit trail is derived from the ledger rows themselves, so the
 * materials page can never show a delivery the stock does not agree with.
 *
 * The safety pack (method statements, construction phase plan) is in the
 * sibling 20260795b_safety_documents.ts, split out for the file-size ceiling.
 */

const PROJECT_ID = "sample-project";

/** Prefix on every approval this seed owns, so the delete pass cannot reach
 *  the client sign-offs (apr1..apr3) the marbella seed owns. */
const APPROVAL_PREFIX = "apr-mat-";

interface MaterialApprovalSpec {
  id: string;
  title: string;
  description: string;
  status: "Pending" | "Approved" | "Rejected" | "Resubmit";
  response: string | null;
  dueDate: string;
  reviewedDaysAgo: number | null;
  materialName: string;
  specification: string;
  quantity: number;
  unit: string;
  supplier: string;
  neededBy: string;
  phaseId: string | null;
  activityId: string | null;
}

/**
 * material_name is matched case-insensitively against material_orders.material_name
 * by repository.approvalStatusByMaterial, so the roofing row deliberately carries
 * mo-seed-1's exact wording: an Ordered sheet order must show an approved sample
 * behind it, or the orders page flags a live order as unapproved.
 */
const MATERIAL_APPROVALS: MaterialApprovalSpec[] = [
  {
    id: `${APPROVAL_PREFIX}roofing`,
    title: "Aluzinc roofing sheet sample — 0.55mm",
    description:
      "Roofmasters sample board for the Block A long-span roof. AZ150 coating, Charcoal finish, 0.55mm base metal thickness.",
    status: "Approved",
    response: "Sample accepted. Order against this batch only; notify us if the mill certificate changes.",
    dueDate: "2026-04-20",
    reviewedDaysAgo: 40,
    materialName: "Long-span aluminium roofing sheets",
    specification: "Aluzinc AZ150, 0.55mm BMT, long-span profile, NIS 619:2008",
    quantity: 420,
    unit: "sqm",
    supplier: "Roofmasters Nigeria",
    neededBy: "2026-05-02",
    phaseId: "p3",
    activityId: "act-3",
  },
  {
    id: `${APPROVAL_PREFIX}rebar`,
    title: "Reinforcement steel 16mm — mill certificate",
    description:
      "Mill certificate and tensile test results for the 16mm bars used in the first-floor columns.",
    status: "Approved",
    response: "Mill cert matches the delivered bundle tags. Yield 460MPa confirmed by Arup.",
    dueDate: "2026-04-10",
    reviewedDaysAgo: 55,
    materialName: "Reinforcement steel 16mm (12m)",
    specification: "BS 4449:2005 Grade B500B, 460MPa yield, ribbed",
    quantity: 120,
    unit: "length",
    supplier: "Julius Berger Materials Depot",
    neededBy: "2026-04-14",
    phaseId: "p2",
    activityId: "act-1",
  },
  {
    id: `${APPROVAL_PREFIX}tile`,
    title: "Vitrified floor tile 600x600 — shade approval",
    description:
      "Three shade options laid out at the Ikorodu showroom. Client to pick before the fit-out order is placed.",
    status: "Pending",
    response: null,
    dueDate: "2026-10-12",
    reviewedDaysAgo: null,
    materialName: "Vitrified floor tile 600x600",
    specification: "Vitrified porcelain, 600x600, matte, water absorption < 0.5% (ISO 13006 BIa)",
    quantity: 220,
    unit: "box",
    supplier: "Ikorodu Ceramics",
    neededBy: "2026-11-15",
    phaseId: "p4",
    activityId: null,
  },
  {
    id: `${APPROVAL_PREFIX}paint`,
    title: "External emulsion — colour and brand",
    description: "PaintCo silk emulsion in Off-White with charcoal trim, per the external finishes schedule.",
    status: "Resubmit",
    response:
      "Owner wants a warmer base. Resubmit with a cream option and a weathering warranty for coastal exposure.",
    dueDate: "2026-11-01",
    reviewedDaysAgo: 2,
    materialName: "Paint emulsion white",
    specification: "Acrylic silk emulsion, exterior grade, 5-year coastal weathering warranty",
    quantity: 60,
    unit: "bucket",
    supplier: "PaintCo NG",
    neededBy: "2026-12-01",
    phaseId: "p4",
    activityId: null,
  },
];

interface DeliverySpec {
  id: string;
  orderId: string;
  qty: number;
  at: string;
  note: string | null;
  rejected: boolean;
  rejectedReason: string | null;
  notes: string;
}

/**
 * Only mo-seed-1 and mo-seed-2 exist, and their own columns already declare
 * what was received: mo-seed-2 is Delivered with actual_cost 620,000 on
 * 2026-04-23, mo-seed-1 is still Ordered with delivered_at null. So accepted
 * quantity must total the full lot on mo-seed-2 and exactly zero on mo-seed-1 —
 * acceptedQuantity() in mappers.ts is what re-derives order status from these
 * rows. Neither load books stock: a pump hose kit and a refused pallet of
 * sheets have no catalogue row, so ledger_entry_id stays null and the seeded
 * on-hand figures are untouched.
 */
const DELIVERIES: DeliverySpec[] = [
  {
    id: "mdel-seed-1",
    orderId: "mo-seed-2",
    qty: 1,
    at: "2026-04-22",
    note: "PPH/DN/2026/0412",
    rejected: true,
    rejectedReason: "50mm hose supplied against a 75mm pump outlet — load refused at the gate",
    notes: "Prime Plant Hire dispatched the wrong bore. Driver turned back from the Lekki gate at 08:40.",
  },
  {
    id: "mdel-seed-2",
    orderId: "mo-seed-2",
    qty: 1,
    at: "2026-04-23",
    note: "PPH/DN/2026/0418",
    rejected: false,
    rejectedReason: null,
    notes: "75mm hose kit plus 200L diesel signed for by the Site Manager. Slab pour started the same morning.",
  },
  {
    id: "mdel-seed-3",
    orderId: "mo-seed-1",
    qty: 140,
    at: "2026-05-02",
    note: "RMN/DN/2026/1187",
    rejected: true,
    rejectedReason: "0.45mm gauge delivered against the approved 0.55mm Aluzinc sample",
    notes:
      "Micrometer check at the gate showed 0.45mm BMT. Whole pallet returned to Roofmasters; balance of 420sqm still outstanding.",
  },
];

/**
 * The global catalogue (Structural, Electrical, Plumbing, Safety, ...) is
 * inserted by the inspection_categories migration and every project already
 * sees it. Repeating those names here would put two identical entries in the
 * picker — the partial unique indexes only police org and project lists, not
 * the global one. So this seeds what a Lagos residential duplex adds on top.
 */
const PROJECT_CATEGORIES = [
  "Blockwork & masonry",
  "Formwork & falsework",
  "Roofing & rainwater",
  "Waterproofing",
  "Finishes & snagging",
  "Borehole & water supply",
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;

  // Every FK below points at `user`, and the seeded actors ("seed-pm",
  // "seed-eng") are free-text display ids with no row behind them. The first
  // real signed-up account stands in so the audit trail has an actor; on a
  // fresh database it is null and the rows still insert.
  const actor = await knex("user")
    .whereNot("id", "like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string }>("id");
  const actorId = actor?.id ?? null;
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  if (await knex.schema.hasTable("material_deliveries")) {
    await knex("material_deliveries").where({ project_id: PROJECT_ID }).del();
    await knex("material_deliveries").insert(
      DELIVERIES.map((d) => ({
        id: d.id,
        project_id: PROJECT_ID,
        order_id: d.orderId,
        delivered_qty: d.qty.toFixed(2),
        delivered_at: d.at,
        delivery_note: d.note,
        received_by_id: actorId,
        notes: d.notes,
        rejected: d.rejected,
        rejected_reason: d.rejectedReason,
        ledger_entry_id: null,
        transaction_id: null,
        created_by_id: actorId,
      })),
    );
  }

  if (await knex.schema.hasTable("material_ledger_entry_events")) {
    await knex("material_ledger_entry_events").where({ project_id: PROJECT_ID }).del();
    // Derived from the ledger rather than hand-written: the audit trail then
    // states exactly the movement each entry actually posted, and a change to
    // the material fixtures upstream cannot leave a contradicting event behind.
    const entries = await knex("material_ledger_entries")
      .where({ project_id: PROJECT_ID })
      .select<Array<{ id: string; entry_type: string; stock_delta: string; occurred_at: Date }>>(
        "id",
        "entry_type",
        "stock_delta",
        "occurred_at",
      );
    if (entries.length > 0) {
      await knex("material_ledger_entry_events").insert(
        entries.map((entry) => ({
          id: `mlev-seed-${entry.id}`,
          project_id: PROJECT_ID,
          entry_id: entry.id,
          event_type: entry.entry_type === "VOID" ? "voided" : "created",
          actor_id: actorId,
          detail: JSON.stringify({
            entryType: entry.entry_type,
            stockDelta: Number(entry.stock_delta),
          }),
          created_at: entry.occurred_at,
        })),
      );
    }
  }

  if (await knex.schema.hasTable("material_ledger_entry_files")) {
    const entryIds = await knex("material_ledger_entries")
      .where({ project_id: PROJECT_ID, entry_type: "IN" })
      .orderBy("occurred_at", "desc")
      .limit(4)
      .pluck<string[]>("id");
    if (entryIds.length > 0) {
      await knex("material_ledger_entry_files").whereIn("entry_id", entryIds).del();
      // Proof photos are only attached to files that really exist in storage:
      // a fabricated uploaded_files row would render as a broken /files/:id
      // download on the ledger, which reads worse than no photo at all.
      const files = await knex("uploaded_files")
        .where("mime_type", "like", "image/%")
        .orderBy("created_at", "desc")
        .limit(entryIds.length)
        .pluck<string[]>("id");
      const links = entryIds
        .slice(0, files.length)
        .map((entryId, index) => ({ entry_id: entryId, file_id: files[index]!, purpose: "ProofPhoto" }));
      if (links.length > 0) await knex("material_ledger_entry_files").insert(links);
    }
  }

  if (await knex.schema.hasTable("material_approval_details")) {
    await knex("approvals").where({ project_id: PROJECT_ID }).andWhere("id", "like", `${APPROVAL_PREFIX}%`).del();
    await knex("approvals").insert(
      MATERIAL_APPROVALS.map((a) => ({
        id: a.id,
        project_id: PROJECT_ID,
        kind: "material",
        title: a.title,
        category: "Materials",
        description: a.description,
        status: a.status,
        response: a.response,
        due_date: a.dueDate,
        submitted_by_id: null,
        reviewed_by_id: a.reviewedDaysAgo === null ? null : actorId,
        reviewed_at: a.reviewedDaysAgo === null ? null : daysAgo(a.reviewedDaysAgo),
      })),
    );
    await knex("material_approval_details").insert(
      MATERIAL_APPROVALS.map((a) => ({
        approval_id: a.id,
        material_name: a.materialName,
        specification: a.specification,
        quantity: a.quantity.toFixed(2),
        unit: a.unit,
        supplier: a.supplier,
        needed_by: a.neededBy,
        phase_id: a.phaseId,
        activity_id: a.activityId,
      })),
    );
  }

  if (await knex.schema.hasTable("inspection_categories")) {
    await knex("inspection_categories").where({ project_id: PROJECT_ID }).del();
    await knex("inspection_categories").insert(
      PROJECT_CATEGORIES.map((name, index) => ({
        id: `insc-seed-${index}`,
        organization_id: null,
        project_id: PROJECT_ID,
        name,
        // Sorted after the global catalogue, which occupies 0..9.
        sort_order: 20 + index,
        active: true,
        created_by_id: actorId,
      })),
    );
    // The marbella seed re-inserts its inspections after the catalogue
    // migration backfilled category_id, so they come back unlinked. Relinking
    // by name keeps the filter chips on the inspections page populated.
    if (await knex.schema.hasColumn("inspections", "category_id")) {
      await knex.raw(
        `UPDATE inspections i
            SET category_id = c.id
           FROM inspection_categories c
          WHERE i.project_id = ?
            AND i.category_id IS NULL
            AND lower(c.name) = lower(i.category)
            AND (c.project_id = ? OR (c.project_id IS NULL AND c.organization_id IS NULL))`,
        [PROJECT_ID, PROJECT_ID],
      );
    }
  }
}
