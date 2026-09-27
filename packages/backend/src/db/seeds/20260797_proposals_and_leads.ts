import type { Knex } from "knex";

// Everything this seed owns carries one prefix so a re-run can clear exactly
// its own rows and leave anything a real user created in the sales pipeline
// untouched.
export const SALES_PREFIX = "seed_sales_";

export const PROPOSAL_ADEYI = `${SALES_PREFIX}prop_adeyi`;
export const PROPOSAL_TERRACE = `${SALES_PREFIX}prop_terrace`;
export const PROPOSAL_POOLHOUSE = `${SALES_PREFIX}prop_poolhouse`;
export const ESTIMATE_ADEYI_R2 = `${SALES_PREFIX}est_adeyi_r2`;
export const ESTIMATE_TERRACE_R1 = `${SALES_PREFIX}est_terrace_r1`;

const PROJECT_ID = "sample-project";

/** Sales rows are organization-scoped; the demo-metrics orgs are not a real tenant. */
export async function firstOrgId(knex: Knex): Promise<string | null> {
  const org = await knex("organization")
    .where("id", "not like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string }>("id");
  return org?.id ?? null;
}

/** created_by / assigned_to are real FKs to `user`; null is legal, a bad id is not. */
export async function firstUserId(knex: Knex, orgId: string): Promise<string | null> {
  const member = await knex("member")
    .where({ organizationId: orgId })
    .whereNot("userId", "like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ userId: string }>("userId");
  return member?.userId ?? null;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDateDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Line = [group: string, description: string, qty: number, unit: string, rate: number];

// Lagos residential rates, mid-2026: a 4-bed detached duplex measured the way a
// Nigerian QS bills it — prelims as time-related charges, concrete by m3, rebar
// by tonne, blockwork/render/paint by m2, external works as a lump.
const DUPLEX: Line[] = [
  ["Preliminaries", "Site establishment, hoarding, temporary water and power", 1, "item", 2_850_000],
  ["Preliminaries", "Site office and secure container store, hire", 8, "month", 185_000],
  ["Preliminaries", "Full-time site supervision and safety officer", 8, "month", 450_000],
  ["Substructure", "Excavation to reduce level and foundation trenches", 420, "m3", 3_500],
  ["Substructure", "Hardcore filling, compaction and blinding", 260, "m2", 7_800],
  ["Substructure", "Reinforced concrete 1:2:4 to pad footings and ground beams", 46, "m3", 185_000],
  ["Substructure", "High-yield reinforcement Y12/Y16 to foundations", 6.5, "tonne", 1_450_000],
  ["Substructure", "225mm sandcrete blockwork to substructure walls", 310, "m2", 9_200],
  ["Substructure", "Damp-proof membrane and anti-termite treatment", 260, "m2", 2_400],
  ["Frame & Superstructure", "Reinforced concrete columns, beams and staircase", 78, "m3", 195_000],
  ["Frame & Superstructure", "150mm suspended slab including formwork and propping", 520, "m2", 42_000],
  ["Frame & Superstructure", "225mm sandcrete blockwork to external and party walls", 940, "m2", 9_600],
  ["Frame & Superstructure", "High-yield reinforcement to frame and slabs", 11.25, "tonne", 1_450_000],
  ["Roofing", "Hardwood roof trusses, purlins and wall plate", 320, "m2", 14_500],
  ["Roofing", "0.55mm Aluzinc long-span roofing sheets and accessories", 340, "m2", 11_800],
  ["Roofing", "Fascia, soffit and aluminium rainwater goods", 86, "m", 18_500],
  ["Finishes", "Cement/sand render to internal and external wall faces", 1_880, "m2", 4_200],
  ["Finishes", "Screed and 600x600 vitrified floor tiling", 480, "m2", 16_500],
  ["Finishes", "Emulsion and gloss painting, three coats", 1_880, "m2", 3_100],
  ["Finishes", "Aluminium casement windows with 6mm tinted glazing", 96, "m2", 62_000],
  ["Finishes", "Panelled internal doors and steel-cored external doors", 22, "no", 185_000],
  ["Finishes", "POP ceiling to soffits with cornice and downlighter cut-outs", 520, "m2", 9_800],
  ["External Works", "Reinforced concrete driveway and parking apron", 180, "m2", 24_500],
  ["External Works", "2.4m perimeter fence wall with coping and gate posts", 96, "m", 78_000],
  ["External Works", "Septic tank, soakaway pit and external drainage runs", 1, "item", 3_250_000],
  ["External Works", "Interlocking paving, kerbs and soft landscaping", 220, "m2", 12_500],
];

// Revision 1 is what was priced before the client added the fence, driveway and
// soakaway, so the supersede reads as a real scope change rather than a reprice.
const DUPLEX_R1 = DUPLEX.filter(([group]) => group !== "External Works");

// A shell-and-core terrace: the client's own fit-out follows, so finishes stop
// at painting and the units are billed per plot rather than remeasured.
const TERRACE: Line[] = [
  ["Preliminaries", "Site establishment and temporary services, three plots", 1, "item", 1_650_000],
  ["Substructure", "Strip foundations, hardcore and ground-floor slab, per unit", 3, "unit", 6_850_000],
  ["Frame & Superstructure", "Reinforced concrete frame and 225mm blockwork shell, per unit", 3, "unit", 14_200_000],
  ["Roofing", "Trussed roof, Aluzinc covering and rainwater goods, per unit", 3, "unit", 3_950_000],
  ["Finishes", "Render, screed, tiling and painting, per unit", 3, "unit", 9_600_000],
  ["External Works", "Shared driveway, drainage, boundary wall and gatehouse", 1, "item", 7_400_000],
];

interface Totals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

// Mirrors proposalsRepository.calcTotals: contingency sits on the subtotal and
// VAT is charged on the contingency-inclusive base, which is how a Nigerian
// tender sum is built up. Derived here so items can never drift from the total.
function totals(lines: Line[], contingencyPct: number, taxPct: number): Totals {
  const subtotal = lines.reduce((sum, [, , qty, , rate]) => sum + round2(qty * rate), 0);
  const base = subtotal + subtotal * (contingencyPct / 100);
  const taxAmount = round2(base * (taxPct / 100));
  return { subtotal: round2(subtotal), taxAmount, total: round2(base) + taxAmount };
}

// A stage schedule the bank and the client both recognise: a mobilisation
// advance, four works stages and a defects release that matches the 5 % cash
// retention held on the contract. The six shares total 100 %, so the schedule
// draws down exactly the estimate total and nothing more.
const SCHEDULE: [label: string, percent: number, kind: string, description: string][] = [
  ["Mobilisation advance", 15, "advance", "Against an advance payment guarantee, before possession of site"],
  ["Substructure complete", 20, "stage", "Oversite slab cast and certified by the structural engineer"],
  ["Frame and roof complete", 25, "stage", "Roof covering watertight and first-floor slab cured"],
  ["Finishes complete", 25, "stage", "Render, screed, tiling, joinery and painting signed off"],
  ["Practical completion", 10, "stage", "Handover, as-built drawings and keys issued"],
  ["Defects release", 5, "stage", "Released at the end of the 180-day defects liability period"],
];

function itemRows(estimateId: string, lines: Line[]): Record<string, unknown>[] {
  return lines.map(([group, description, qty, unit, rate], i) => ({
    id: `${SALES_PREFIX}ei_${estimateId.slice(SALES_PREFIX.length)}_${i}`,
    estimate_id: estimateId,
    group_label: group,
    description,
    qty: qty.toFixed(3),
    unit,
    unit_rate: rate.toFixed(2),
    total: round2(qty * rate).toFixed(2),
    sort: i,
  }));
}

function scheduleRows(estimateId: string): Record<string, unknown>[] {
  return SCHEDULE.map(([label, percent, kind, description], i) => ({
    id: `${SALES_PREFIX}eps_${estimateId.slice(SALES_PREFIX.length)}_${i}`,
    estimate_id: estimateId,
    label,
    percent: percent.toFixed(2),
    description,
    kind,
    sort: i,
  }));
}

async function clearOwnRows(knex: Knex): Promise<void> {
  // Children first: the FKs cascade, but an explicit order keeps the delete
  // honest if a table is ever detached from its parent.
  for (const table of [
    "estimate_payment_schedule",
    "estimate_items",
    "estimates",
    "proposal_comments",
    "proposal_events",
    "proposal_collaborators",
    "proposals",
    "leads",
  ]) {
    if (await knex.schema.hasTable(table)) {
      await knex(table).where("id", "like", `${SALES_PREFIX}%`).del();
    }
  }
}

export async function seed(knex: Knex): Promise<void> {
  await clearOwnRows(knex);

  const orgId = await firstOrgId(knex);
  // Leads and proposals hang off an organization; on a fresh database with no
  // signups there is no tenant to attach them to. Re-run after signing up.
  if (!orgId) return;
  const userId = await firstUserId(knex, orgId);
  // project_id is a real FK; the Sample Project only exists once the earlier
  // seed has run against this database.
  const sampleProject = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>("id");
  const convertedProjectId = sampleProject?.id ?? null;

  if (await knex.schema.hasTable("leads")) {
    await knex("leads").insert([
      { id: `${SALES_PREFIX}lead_adeyi`, org_id: orgId, name: "Mr. & Mrs. Adeyi", email: "adeyi.client@buildpanda.demo", phone: "+234 802 411 0987", location: "Ikoyi, Lagos", project_type: "Residential — detached duplex", message: "We have a 900sqm plot off Glover Road and approved architectural drawings. Looking to start before the rains.", source: "website", status: "Won", assigned_to: userId, notes: "Drawings received. Converted to Sample Project after the revised estimate was accepted.", created_at: isoDaysAgo(96), updated_at: isoDaysAgo(34) },
      { id: `${SALES_PREFIX}lead_terrace`, org_id: orgId, name: "Chinelo Eze", email: "chinelo.eze@ezeholdings.ng", phone: "+234 809 773 2210", location: "Lekki Phase 1, Lagos", project_type: "Residential — 3-unit terrace", message: "Shell and core only for three terrace units. Our own fit-out team follows.", source: "referral", status: "ProposalOpened", assigned_to: userId, notes: "Opened the estimate link twice. Waiting on her structural engineer's comments.", created_at: isoDaysAgo(41), updated_at: isoDaysAgo(6) },
      { id: `${SALES_PREFIX}lead_poolhouse`, org_id: orgId, name: "Tunde Bakare", email: "tunde.bakare@outlook.com", phone: "+234 703 118 4402", location: "Banana Island, Lagos", project_type: "Residential — pool house and BQ", message: "Small annexe behind an existing house. Need it done in four months.", source: "website", status: "Lost", assigned_to: userId, notes: "Went with an in-house contractor already on his main house. Keep warm for the main refurbishment.", created_at: isoDaysAgo(58), updated_at: isoDaysAgo(22) },
      { id: `${SALES_PREFIX}lead_school`, org_id: orgId, name: "Grace Foundation Schools", email: "projects@gracefoundation.edu.ng", phone: "+234 812 664 0071", location: "Magodo, Lagos", project_type: "Institutional — classroom block", message: "Six-classroom block with assembly hall. Board wants a budget figure this term.", source: "website", status: "Qualified", assigned_to: userId, notes: "Site visit done. Awaiting the surveyor's report before pricing.", created_at: isoDaysAgo(19), updated_at: isoDaysAgo(9) },
      { id: `${SALES_PREFIX}lead_ajah`, org_id: orgId, name: "Ibrahim Salisu", email: "ibrahim.salisu@gmail.com", phone: "+234 806 220 5513", location: "Ajah, Lagos", project_type: "Residential — bungalow", message: "Three-bedroom bungalow on a 600sqm plot. No drawings yet.", source: "website", status: "Contacted", assigned_to: userId, notes: "Called back once. Needs an architect before anything can be measured.", created_at: isoDaysAgo(11), updated_at: isoDaysAgo(8) },
      { id: `${SALES_PREFIX}lead_yaba`, org_id: orgId, name: "Folake Adisa", email: "folake.adisa@techpark.ng", phone: "+234 815 909 3376", location: "Yaba, Lagos", project_type: "Commercial — office fit-out", message: "1,200sqm office floor. Consultation requested from the marketing site.", source: "website", status: "New", assigned_to: null, notes: null, created_at: isoDaysAgo(3), updated_at: isoDaysAgo(3) },
    ]);
  }

  if (!(await knex.schema.hasTable("proposals"))) return;

  // proposals is unique on (org_id, number) and the app takes max + 1, so this
  // seed numbers above whatever the tenant already has rather than colliding.
  const highest = await knex("proposals")
    .where({ org_id: orgId })
    .max<{ max: number | null }[]>("number as max")
    .first();
  const base = (highest?.max ?? 0) + 1;

  await knex("proposals").insert([
    { id: PROPOSAL_ADEYI, org_id: orgId, lead_id: `${SALES_PREFIX}lead_adeyi`, project_id: convertedProjectId, number: base, title: "Adeyi Residence — 4-bedroom detached duplex", client_name: "Mr. & Mrs. Adeyi", client_email: "adeyi.client@buildpanda.demo", client_phone: "+234 802 411 0987", location: "Plot 14, Glover Road, Ikoyi, Lagos", brief: "Full contract for a 4-bedroom detached duplex with attached BQ on a 900sqm plot. Build-up area 520sqm over two floors, reinforced concrete frame, Aluzinc roof, full external works.", status: "Converted", currency: "NGN", valid_until: isoDateDaysAgo(32), job_profile: "full_contract", created_by: userId, created_at: isoDaysAgo(92), updated_at: isoDaysAgo(34) },
    { id: PROPOSAL_TERRACE, org_id: orgId, lead_id: `${SALES_PREFIX}lead_terrace`, project_id: null, number: base + 1, title: "Eze Terrace — 3 units, shell and core", client_name: "Chinelo Eze", client_email: "chinelo.eze@ezeholdings.ng", client_phone: "+234 809 773 2210", location: "Off Admiralty Way, Lekki Phase 1, Lagos", brief: "Shell and core for three 3-bedroom terrace units. Client's own contractor handles joinery, MEP second fix and kitchen fit-out.", status: "UnderReview", currency: "NGN", valid_until: isoDateDaysAgo(-23), job_profile: "full_contract", created_by: userId, created_at: isoDaysAgo(37), updated_at: isoDaysAgo(6) },
    { id: PROPOSAL_POOLHOUSE, org_id: orgId, lead_id: `${SALES_PREFIX}lead_poolhouse`, project_id: null, number: base + 2, title: "Bakare Pool House & BQ", client_name: "Tunde Bakare", client_email: "tunde.bakare@outlook.com", client_phone: "+234 703 118 4402", location: "Banana Island, Lagos", brief: "Single-storey pool house with two-room boys' quarters behind an occupied residence. Labour-only: the client supplies all materials from his main build.", status: "Lost", currency: "NGN", valid_until: isoDateDaysAgo(25), job_profile: "labour_only", created_by: userId, created_at: isoDaysAgo(55), updated_at: isoDaysAgo(22) },
  ]);

  if (await knex.schema.hasTable("estimates")) {
    const r1 = totals(DUPLEX_R1, 5, 7.5);
    const r2 = totals(DUPLEX, 5, 7.5);
    const terrace = totals(TERRACE, 7.5, 7.5);
    const revision1 = `${SALES_PREFIX}est_adeyi_r1`;

    await knex("estimates").insert([
      { id: revision1, proposal_id: PROPOSAL_ADEYI, revision_no: 1, status: "Superseded", contingency_pct: "5.00", tax_label: "VAT", tax_pct: "7.50", change_note: null, subtotal: r1.subtotal.toFixed(2), tax_amount: r1.taxAmount.toFixed(2), total: r1.total.toFixed(2), retention_pct: "5.00", retention_mode: "cash", advance_pct: "15.00", wht_pct: "0.00", payment_terms_days: 14, defects_liability_days: 180, client_visible_detail: "groups", sent_at: isoDaysAgo(74), created_at: isoDaysAgo(80), updated_at: isoDaysAgo(62) },
      // The accepted revision carries the acceptance evidence, so a later
      // dispute can be read against exactly what the client signed.
      { id: ESTIMATE_ADEYI_R2, proposal_id: PROPOSAL_ADEYI, revision_no: 2, status: "Accepted", contingency_pct: "5.00", tax_label: "VAT", tax_pct: "7.50", change_note: "Added external works: fence wall, driveway, septic/soakaway and landscaping, per the client's 12 June instruction.", subtotal: r2.subtotal.toFixed(2), tax_amount: r2.taxAmount.toFixed(2), total: r2.total.toFixed(2), retention_pct: "5.00", retention_mode: "cash", advance_pct: "15.00", wht_pct: "0.00", payment_terms_days: 14, defects_liability_days: 180, client_visible_detail: "lines", sent_at: isoDaysAgo(58), accepted_at: isoDaysAgo(41), accepted_by_name: "Mr. Olusegun Adeyi", accepted_ip: "105.112.44.18", accepted_user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15", response_message: "Happy with the revised scope. Please proceed once the advance guarantee is in place.", created_at: isoDaysAgo(62), updated_at: isoDaysAgo(41) },
      { id: ESTIMATE_TERRACE_R1, proposal_id: PROPOSAL_TERRACE, revision_no: 1, status: "Sent", contingency_pct: "7.50", tax_label: "VAT", tax_pct: "7.50", change_note: null, subtotal: terrace.subtotal.toFixed(2), tax_amount: terrace.taxAmount.toFixed(2), total: terrace.total.toFixed(2), retention_pct: "5.00", retention_mode: "cash", advance_pct: "15.00", wht_pct: "2.00", payment_terms_days: 21, defects_liability_days: 180, client_visible_detail: "lines", share_token: `${SALES_PREFIX}share_terrace`, share_token_expires_at: isoDaysAgo(-23), sent_at: isoDaysAgo(12), created_at: isoDaysAgo(20), updated_at: isoDaysAgo(12) },
    ]);

    if (await knex.schema.hasTable("estimate_items")) {
      await knex("estimate_items").insert([
        ...itemRows(revision1, DUPLEX_R1),
        ...itemRows(ESTIMATE_ADEYI_R2, DUPLEX),
        ...itemRows(ESTIMATE_TERRACE_R1, TERRACE),
      ]);
    }

    if (await knex.schema.hasTable("estimate_payment_schedule")) {
      await knex("estimate_payment_schedule").insert([
        ...scheduleRows(revision1),
        ...scheduleRows(ESTIMATE_ADEYI_R2),
        ...scheduleRows(ESTIMATE_TERRACE_R1),
      ]);
    }
  }

  if (await knex.schema.hasTable("proposal_collaborators")) {
    await knex("proposal_collaborators").insert([
      { id: `${SALES_PREFIX}col_adeyi_owner`, proposal_id: PROPOSAL_ADEYI, email: "adeyi.client@buildpanda.demo", role: "homeowner", user_id: null, created_at: isoDaysAgo(88) },
      { id: `${SALES_PREFIX}col_adeyi_arch`, proposal_id: PROPOSAL_ADEYI, email: "studio@kunlearchitects.ng", role: "architect", user_id: null, created_at: isoDaysAgo(86) },
      // Still live, so the invite token is the one the client is using now.
      { id: `${SALES_PREFIX}col_terrace_owner`, proposal_id: PROPOSAL_TERRACE, email: "chinelo.eze@ezeholdings.ng", role: "homeowner", invite_token: `${SALES_PREFIX}invite_terrace`, invite_expires_at: isoDaysAgo(-23), user_id: null, created_at: isoDaysAgo(20) },
      { id: `${SALES_PREFIX}col_terrace_arch`, proposal_id: PROPOSAL_TERRACE, email: "angela.bello@arup.com", role: "architect", user_id: null, created_at: isoDaysAgo(18) },
    ]);
  }

  if (await knex.schema.hasTable("proposal_comments")) {
    await knex("proposal_comments").insert([
      { id: `${SALES_PREFIX}cmt_1`, proposal_id: PROPOSAL_ADEYI, author_id: null, author_name: "Engr. David Okonjo", body: "Rebar tonnage is measured off the structural drawings at 17.75 tonnes across foundations and frame. That includes 5% laps and waste.", created_at: isoDaysAgo(79) },
      { id: `${SALES_PREFIX}cmt_2`, proposal_id: PROPOSAL_ADEYI, author_id: null, author_name: "Homeowner", body: "Can you price the fence wall and driveway as well? We would rather do it all in one contract than bring another contractor on site later.", created_at: isoDaysAgo(66) },
      { id: `${SALES_PREFIX}cmt_3`, proposal_id: PROPOSAL_ADEYI, author_id: userId, author_name: "Site Manager", body: "Added as revision 2 — external works come to ₦17,898,000 before contingency and VAT. Revision 1 is superseded.", created_at: isoDaysAgo(62) },
      { id: `${SALES_PREFIX}cmt_4`, proposal_id: PROPOSAL_TERRACE, author_id: null, author_name: "Engr. David Okonjo", body: "Shell and core only: no MEP second fix, no kitchens, no wardrobes. Worth stating that in the exclusions before she sends it to her engineer.", created_at: isoDaysAgo(9) },
      { id: `${SALES_PREFIX}cmt_5`, proposal_id: PROPOSAL_TERRACE, author_id: userId, author_name: "Site Manager", body: "Exclusions updated. Contingency is at 7.5% here because the soil report for the Lekki plot is not in yet.", created_at: isoDaysAgo(6) },
    ]);
  }

  if (await knex.schema.hasTable("proposal_events")) {
    await knex("proposal_events").insert([
      { id: `${SALES_PREFIX}ev_1`, proposal_id: PROPOSAL_ADEYI, type: "created", actor: "seed-pm", metadata: JSON.stringify({ source: "lead", leadId: `${SALES_PREFIX}lead_adeyi` }), created_at: isoDaysAgo(92) },
      { id: `${SALES_PREFIX}ev_2`, proposal_id: PROPOSAL_ADEYI, type: "estimate_drafted", actor: "seed-eng", metadata: JSON.stringify({ revisionNo: 1 }), created_at: isoDaysAgo(80) },
      { id: `${SALES_PREFIX}ev_3`, proposal_id: PROPOSAL_ADEYI, type: "estimate_sent", actor: "seed-pm", metadata: JSON.stringify({ revisionNo: 1, to: "adeyi.client@buildpanda.demo" }), created_at: isoDaysAgo(74) },
      { id: `${SALES_PREFIX}ev_4`, proposal_id: PROPOSAL_ADEYI, type: "client_viewed", actor: "seed-owner", metadata: JSON.stringify({ revisionNo: 1 }), created_at: isoDaysAgo(72) },
      { id: `${SALES_PREFIX}ev_5`, proposal_id: PROPOSAL_ADEYI, type: "client_change_requested", actor: "seed-owner", metadata: JSON.stringify({ revisionNo: 1, message: "Please include the fence wall and driveway." }), created_at: isoDaysAgo(66) },
      { id: `${SALES_PREFIX}ev_6`, proposal_id: PROPOSAL_ADEYI, type: "estimate_drafted", actor: "seed-eng", metadata: JSON.stringify({ revisionNo: 2, supersedes: 1 }), created_at: isoDaysAgo(62) },
      { id: `${SALES_PREFIX}ev_7`, proposal_id: PROPOSAL_ADEYI, type: "estimate_sent", actor: "seed-pm", metadata: JSON.stringify({ revisionNo: 2, to: "adeyi.client@buildpanda.demo" }), created_at: isoDaysAgo(58) },
      { id: `${SALES_PREFIX}ev_8`, proposal_id: PROPOSAL_ADEYI, type: "client_accepted", actor: "seed-owner", metadata: JSON.stringify({ revisionNo: 2, acceptedByName: "Mr. Olusegun Adeyi" }), created_at: isoDaysAgo(41) },
      { id: `${SALES_PREFIX}ev_9`, proposal_id: PROPOSAL_ADEYI, type: "converted", actor: "seed-pm", metadata: JSON.stringify({ projectId: convertedProjectId }), created_at: isoDaysAgo(34) },
      { id: `${SALES_PREFIX}ev_10`, proposal_id: PROPOSAL_TERRACE, type: "created", actor: "seed-pm", metadata: JSON.stringify({ source: "lead", leadId: `${SALES_PREFIX}lead_terrace` }), created_at: isoDaysAgo(37) },
      { id: `${SALES_PREFIX}ev_11`, proposal_id: PROPOSAL_TERRACE, type: "estimate_drafted", actor: "seed-eng", metadata: JSON.stringify({ revisionNo: 1 }), created_at: isoDaysAgo(20) },
      { id: `${SALES_PREFIX}ev_12`, proposal_id: PROPOSAL_TERRACE, type: "estimate_sent", actor: "seed-pm", metadata: JSON.stringify({ revisionNo: 1, to: "chinelo.eze@ezeholdings.ng" }), created_at: isoDaysAgo(12) },
      { id: `${SALES_PREFIX}ev_13`, proposal_id: PROPOSAL_TERRACE, type: "client_viewed", actor: "seed-owner", metadata: JSON.stringify({ revisionNo: 1, viewCount: 2 }), created_at: isoDaysAgo(6) },
      { id: `${SALES_PREFIX}ev_14`, proposal_id: PROPOSAL_POOLHOUSE, type: "created", actor: "seed-pm", metadata: JSON.stringify({ source: "lead", leadId: `${SALES_PREFIX}lead_poolhouse` }), created_at: isoDaysAgo(55) },
      { id: `${SALES_PREFIX}ev_15`, proposal_id: PROPOSAL_POOLHOUSE, type: "client_declined", actor: "seed-owner", metadata: JSON.stringify({ reason: "Awarded to the contractor already on the main house." }), created_at: isoDaysAgo(22) },
    ]);
  }
}
