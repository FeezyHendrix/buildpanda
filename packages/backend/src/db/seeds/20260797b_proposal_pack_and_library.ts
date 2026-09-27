import type { Knex } from "knex";
import {
  ESTIMATE_ADEYI_R2,
  ESTIMATE_TERRACE_R1,
  PROPOSAL_ADEYI,
  PROPOSAL_TERRACE,
  SALES_PREFIX,
  firstOrgId,
  firstUserId,
} from "./20260797_proposals_and_leads.ts";

// The prose, drawings and reusable library that sit around the estimate seeded
// in 20260797. Split out only to keep both files inside the 400-line ceiling.

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type Boq = [group: string, description: string, qty: number, unit: string];

// The measured quantities the estimate was priced from — same trades, no rates.
const ADEYI_BOQ: Boq[] = [
  ["Substructure", "Excavation to reduce level and foundation trenches", 420, "m3"],
  ["Substructure", "Reinforced concrete 1:2:4 to pad footings and ground beams", 46, "m3"],
  ["Substructure", "High-yield reinforcement Y12/Y16 to foundations", 6.5, "tonne"],
  ["Frame & Superstructure", "Reinforced concrete columns, beams and staircase", 78, "m3"],
  ["Frame & Superstructure", "150mm suspended slab measured on plan", 520, "m2"],
  ["Frame & Superstructure", "225mm sandcrete blockwork, net of openings", 940, "m2"],
  ["Roofing", "Roof area on slope, hips and valleys included", 340, "m2"],
  ["Finishes", "Render to wall faces, both sides where exposed", 1880, "m2"],
  ["Finishes", "Floor tiling to habitable rooms and circulation", 480, "m2"],
  ["External Works", "Perimeter fence wall, girth measured on centreline", 96, "m"],
];

const TERRACE_BOQ: Boq[] = [
  ["Substructure", "Strip foundation trenches, three units", 186, "m"],
  ["Frame & Superstructure", "Reinforced concrete frame, three units", 132, "m3"],
  ["Frame & Superstructure", "225mm blockwork shell, three units", 1410, "m2"],
  ["Roofing", "Roof area on slope, three units", 612, "m2"],
  ["External Works", "Shared driveway and parking bays", 310, "m2"],
];

type Section = [kind: string, origin: string, bodyHtml: string];

const ADEYI_PACK: Section[] = [
  ["scope", "manual", "<p>Construction of a four-bedroom detached duplex with attached boys' quarters on Plot 14, Glover Road, Ikoyi, to the architectural and structural drawings listed in this pack. The works comprise substructure, reinforced concrete frame, blockwork, roofing, internal and external finishes, and all external works including the perimeter fence wall, driveway, septic tank and soakaway.</p>"],
  ["exclusions", "manual", "<p>The following are not included and will be quoted separately if instructed:</p><ul><li>Furniture, curtains, blinds and loose fittings</li><li>Solar installation, inverter and battery bank</li><li>Borehole, pump house and water treatment plant</li><li>Swimming pool and pool plant</li><li>Statutory approvals, development levies and LASBCA fees</li><li>Electricity connection charges payable to the DisCo</li></ul>"],
  ["assumptions", "manual", "<p>Priced on the assumption that the plot is handed over cleared and free of encumbrance, that the allowable bearing capacity is not less than 150 kN/m² as stated in the soil report of 8 April 2026, and that access is available for a 20-tonne tipper. Uninterrupted access to site between 07:00 and 18:00 Monday to Saturday is assumed; any restriction imposed by the estate management that materially affects the programme is a variation.</p>"],
  ["provisional_sums", "manual", "<p>The following provisional sums are carried within the estimate and will be adjusted against measured work on instruction:</p><ul><li>Kitchen joinery and worktops — ₦6,500,000</li><li>Sanitary ware and brassware — ₦4,200,000</li><li>Light fittings and switchgear — ₦2,800,000</li></ul><p>Any balance unspent is credited to the client at final account.</p>"],
  ["warranties", "manual", "<p>A defects liability period of 180 days runs from the date of practical completion. Structural works are warranted for ten years against defects in workmanship. Manufacturer warranties on the Aluzinc roof covering (20 years) and aluminium windows (5 years) are assigned to the client at handover.</p>"],
  ["terms", "manual", "<p>Payment is by the stage schedule attached. Invoices are due within 14 days of certification. Cash retention of 5% is held on each certificate and released at the end of the defects liability period. The mobilisation advance is released against an advance payment guarantee from a Nigerian bank. VAT at 7.5% is charged on the contract sum. No withholding tax is deducted, the client being an individual.</p>"],
  ["site_survey", "ai", "<p>Site visited 3 April 2026. The 900sqm plot is level, sand-filled and fenced on three sides with a 1.8m block wall in fair condition on the eastern boundary, which is to be retained. The existing wall on the northern boundary is out of plumb and is included for demolition and rebuilding. Ground water was not encountered in the trial pits at 2.5m. Access is from Glover Road via a 6m estate road; a tipper can reach the plot but not turn on it, so material deliveries are assumed to reverse in.</p>"],
];

const TERRACE_PACK: Section[] = [
  ["scope", "manual", "<p>Shell and core construction of three three-bedroom terrace units off Admiralty Way, Lekki Phase 1: substructure, reinforced concrete frame, blockwork, roof, render, screed, floor tiling and painting, plus shared external works.</p>"],
  ["exclusions", "manual", "<p>Excluded, the client's own contractor following on: MEP second fix, kitchens, wardrobes, internal joinery beyond door frames, sanitary ware, and all loose fittings. Soil investigation is excluded and is assumed to be procured by the client before mobilisation.</p>"],
  ["assumptions", "ai", "<p>Contingency is carried at 7.5% rather than the usual 5% because the geotechnical report for the plot has not been issued. Should the report require piling or an engineered raft in place of the strip foundations priced here, the substructure is remeasured.</p>"],
  ["terms", "template", "<p>Stage payments as scheduled, due within 21 days of certification. 5% cash retention released after 180 days. Withholding tax at 2% is deducted at source, the client being a resident company. VAT at 7.5% applies.</p>"],
];

export async function seed(knex: Knex): Promise<void> {
  for (const table of ["proposal_plans", "proposal_pack_sections", "proposal_boq_items", "proposal_templates"]) {
    if (await knex.schema.hasTable(table)) {
      await knex(table).where("id", "like", `${SALES_PREFIX}%`).del();
    }
  }
  if (await knex.schema.hasTable("uploaded_files")) {
    await knex("uploaded_files").where("id", "like", `${SALES_PREFIX}%`).del();
  }

  const orgId = await firstOrgId(knex);
  if (!orgId) return;
  const userId = await firstUserId(knex, orgId);

  // Nothing below can attach without the proposals from 20260797.
  const proposal = await knex("proposals").where({ id: PROPOSAL_ADEYI }).first<{ id: string }>("id");
  if (!proposal) return;

  if (await knex.schema.hasTable("proposal_boq_items")) {
    const rows = [
      ...ADEYI_BOQ.map((b, i) => ({ proposalId: PROPOSAL_ADEYI, key: `adeyi_${i}`, b, sort: i })),
      ...TERRACE_BOQ.map((b, i) => ({ proposalId: PROPOSAL_TERRACE, key: `terrace_${i}`, b, sort: i })),
    ];
    await knex("proposal_boq_items").insert(
      rows.map(({ proposalId, key, b, sort }) => ({
        id: `${SALES_PREFIX}boq_${key}`,
        proposal_id: proposalId,
        group_label: b[0],
        description: b[1],
        qty: b[2].toFixed(3),
        unit: b[3],
        sort,
      })),
    );
  }

  if (await knex.schema.hasTable("proposal_pack_sections")) {
    const sections = [
      ...ADEYI_PACK.map((s, i) => ({ proposalId: PROPOSAL_ADEYI, estimateId: ESTIMATE_ADEYI_R2, key: `adeyi_${s[0]}`, s, sort: i })),
      ...TERRACE_PACK.map((s, i) => ({ proposalId: PROPOSAL_TERRACE, estimateId: ESTIMATE_TERRACE_R1, key: `terrace_${s[0]}`, s, sort: i })),
    ];
    // Pack text is written against the revision it was offered with, so an
    // accepted pack can still be read after a later revision is drafted.
    const estimateIds = new Set(
      (await knex("estimates")
        .whereIn("id", [ESTIMATE_ADEYI_R2, ESTIMATE_TERRACE_R1])
        .select<{ id: string }[]>("id")).map((r) => r.id),
    );
    await knex("proposal_pack_sections").insert(
      sections.map(({ proposalId, estimateId, key, s, sort }) => ({
        id: `${SALES_PREFIX}pack_${key}`,
        proposal_id: proposalId,
        estimate_id: estimateIds.has(estimateId) ? estimateId : null,
        kind: s[0],
        body_html: s[2],
        sort,
        origin: s[1],
        updated_by: userId,
        created_at: isoDaysAgo(60),
        updated_at: isoDaysAgo(42),
      })),
    );
  }

  // proposal_plans.file_id is a NOT NULL FK into uploaded_files, whose owner is
  // itself a NOT NULL FK into user: with no signed-up user there is nobody to
  // own the drawings, so the drawing register is left empty rather than faked.
  if (userId && (await knex.schema.hasTable("proposal_plans")) && (await knex.schema.hasTable("uploaded_files"))) {
    const plans: [key: string, sheet: string, discipline: string, revision: string, label: string, daysAgo: number][] = [
      ["a101a", "A-101", "architectural", "A", "Ground floor plan", 90],
      ["a101b", "A-101", "architectural", "B", "Ground floor plan — kitchen island revised", 64],
      ["a201", "A-201", "architectural", "A", "Elevations, all four faces", 90],
      ["s101", "S-101", "structural", "B", "Foundation layout and pad schedule", 78],
      ["s201", "S-201", "structural", "B", "First floor slab reinforcement", 78],
      ["m101", "M-101", "mep", "A", "Plumbing and drainage layout", 70],
      ["c101", "C-101", "civil", "A", "External works, driveway and drainage", 61],
    ];
    await knex("uploaded_files").insert(
      plans.map(([key, sheet, , revision, , daysAgo]) => ({
        id: `${SALES_PREFIX}file_${key}`,
        owner_id: userId,
        file_name: `Adeyi-${sheet}-Rev${revision}.pdf`,
        mime_type: "application/pdf",
        size_bytes: 1_800_000 + sheet.length * 40_000,
        storage_path: `seed/proposals/adeyi/${sheet}-Rev${revision}.pdf`,
        created_at: isoDaysAgo(daysAgo),
      })),
    );
    await knex("proposal_plans").insert(
      plans.map(([key, sheet, discipline, revision, label, daysAgo], i) => ({
        id: `${SALES_PREFIX}plan_${key}`,
        proposal_id: PROPOSAL_ADEYI,
        file_id: `${SALES_PREFIX}file_${key}`,
        label,
        uploaded_by: userId,
        uploaded_at: isoDaysAgo(daysAgo),
        sort: i,
        sheet_code: sheet,
        discipline,
        revision,
        // A-101 Rev A is superseded by Rev B; every other sheet is the current
        // issue, and nothing measured against Rev A carries over silently.
        revision_status: key === "a101a" ? "superseded" : "current",
      })),
    );
    await knex("proposal_plans")
      .where({ id: `${SALES_PREFIX}plan_a101b` })
      .update({ supersedes_plan_id: `${SALES_PREFIX}plan_a101a` });
  }

  if (await knex.schema.hasTable("proposal_templates")) {
    await knex("proposal_templates").insert([
      {
        id: `${SALES_PREFIX}tpl_residential`,
        org_id: orgId,
        name: "Residential full contract — Lagos",
        job_profile: "full_contract",
        pack_sections: JSON.stringify(
          ADEYI_PACK.filter(([kind]) => kind !== "site_survey").map(([kind, , bodyHtml], sort) => ({ kind, bodyHtml, sort })),
        ),
        payment_schedule: JSON.stringify([
          { label: "Mobilisation advance", percent: 15, description: "Against an advance payment guarantee", kind: "advance", sort: 0 },
          { label: "Substructure complete", percent: 20, description: "Oversite slab cast and certified", kind: "stage", sort: 1 },
          { label: "Frame and roof complete", percent: 25, description: "Roof watertight", kind: "stage", sort: 2 },
          { label: "Finishes complete", percent: 25, description: "Finishes signed off", kind: "stage", sort: 3 },
          { label: "Practical completion", percent: 10, description: "Handover and as-builts", kind: "stage", sort: 4 },
          { label: "Defects release", percent: 5, description: "End of defects liability period", kind: "stage", sort: 5 },
        ]),
        // No WHT: the house-building client is an individual, not a company.
        terms: JSON.stringify({ retentionPct: 5, retentionMode: "cash", advancePct: 15, whtPct: 0, paymentTermsDays: 14, defectsLiabilityDays: 180, clientVisibleDetail: "lines", validDays: 30 }),
        contingency_pct: "5.00",
        tax_label: "VAT",
        tax_pct: "7.50",
        created_by: userId,
        created_at: isoDaysAgo(120),
        updated_at: isoDaysAgo(45),
      },
      {
        id: `${SALES_PREFIX}tpl_labour_only`,
        org_id: orgId,
        name: "Labour-only — client supplies materials",
        job_profile: "labour_only",
        pack_sections: JSON.stringify([
          { kind: "scope", bodyHtml: "<p>Labour, supervision, scaffolding, small tools and plant for the works described. All permanent materials are supplied by the client and taken into our charge on delivery.</p>", sort: 0 },
          { kind: "exclusions", bodyHtml: "<p>All permanent materials, site security outside working hours, and wastage arising from materials delivered damaged or out of specification.</p>", sort: 1 },
          { kind: "assumptions", bodyHtml: "<p>Materials are assumed to be on site ahead of each trade. Standing time caused by late delivery is charged at the day rates in the schedule.</p>", sort: 2 },
        ]),
        // Labour-only runs on shorter stages: no advance is warranted when the
        // contractor carries no material cost.
        payment_schedule: JSON.stringify([
          { label: "Substructure labour complete", percent: 25, description: null, kind: "stage", sort: 0 },
          { label: "Frame and roof labour complete", percent: 35, description: null, kind: "stage", sort: 1 },
          { label: "Finishes labour complete", percent: 30, description: null, kind: "stage", sort: 2 },
          { label: "Defects release", percent: 10, description: "End of defects liability period", kind: "stage", sort: 3 },
        ]),
        terms: JSON.stringify({ retentionPct: 10, retentionMode: "cash", advancePct: 0, whtPct: 5, paymentTermsDays: 7, defectsLiabilityDays: 90, clientVisibleDetail: "groups", validDays: 21 }),
        contingency_pct: "2.50",
        tax_label: "VAT",
        tax_pct: "7.50",
        created_by: userId,
        created_at: isoDaysAgo(110),
        updated_at: isoDaysAgo(58),
      },
    ]);
  }
}
