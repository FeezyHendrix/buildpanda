import type { Knex } from "knex";

/**
 * Second-layer demo data for the sample project: the records that hang off the
 * tasks and RFIs seeded in 20260775_marbella_modern.ts. Those parents are
 * inserted with random ids on every run, so everything here is resolved by a
 * natural key (task title, RFI number, invoice number) rather than a literal id.
 */
const PROJECT_ID = "sample-project";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

interface TeamMemberSpec {
  name: string;
  role: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  responsibilities: string;
  status: "Active" | "Inactive";
}

// The same cast that already appears as update authors, inspectors, suppliers
// and participants elsewhere in the fixture — a second, contradicting set of
// names would make the demo read as two different projects.
const TEAM: TeamMemberSpec[] = [
  { name: "Arinze Obi", role: "Lead Contractor", company: "Adeyemi Crew", email: "arinze.obi@buildpanda.demo", phone: "+234 803 441 2087", responsibilities: "Day-to-day delivery on site, subcontractor coordination, weekly progress updates.", status: "Active" },
  { name: "Dr. Angela Bello", role: "Structural Engineer", company: "Ove Arup & Associates", email: "abello@arup.com", phone: "+234 703 220 5544", responsibilities: "Structural design, rebar and formwork approvals, post-pour inspections.", status: "Active" },
  { name: "Engr. David Okonjo", role: "Site Engineer", company: "Adeyemi Crew", email: "david.okonjo@buildpanda.demo", phone: "+234 802 550 6631", responsibilities: "Setting out, concrete and rebar quality checks, inspection records.", status: "Active" },
  { name: "Tunde Bakare", role: "Site Inspector", company: null, email: "tunde.bakare@buildpanda.demo", phone: "+234 806 220 1144", responsibilities: "Independent inspection reports and snag lists.", status: "Active" },
  { name: "Yusuf Adeyemi", role: "Labour Foreman", company: "Adeyemi Crew", email: "yusuf@adeyemicrew.ng", phone: "+234 803 771 4409", responsibilities: "Daily labour allocation, timesheets, weekly wage returns.", status: "Active" },
  { name: "Ibrahim Danjuma", role: "Formwork Subcontractor", company: "Fabrique Formworks", email: "quotes@fabrique.ng", phone: "+234 703 995 4488", responsibilities: "Slab soffit shuttering, column boxes, striking and re-propping.", status: "Active" },
  { name: "Emeka Ibe", role: "Access & Scaffold Coordinator", company: "ScaffoldPro NG", email: "hire@scaffoldpro.ng", phone: "+234 809 271 3355", responsibilities: "Scaffold erection, weekly handover inspections, hire records.", status: "Active" },
  { name: "Ada Chukwu", role: "Site Security Supervisor", company: "Sentinel Security", email: "ops@sentinel-sec.ng", phone: "+234 810 552 7788", responsibilities: "Night security roster, material store access log.", status: "Active" },
  // Demobilised after the foundations, so the roster has a realistic inactive
  // row rather than every member reading as currently on site.
  { name: "Chika Nwosu", role: "Setting-out Surveyor", company: "Kolo Survey Partners", email: null, phone: "+234 805 330 7712", responsibilities: "Boundary survey and setting out; demobilised after the substructure.", status: "Inactive" },
];

const SUBTASKS: { task: string; items: { title: string; done: boolean }[] }[] = [
  { task: "Slab shuttering — first floor", items: [
    { title: "Hire props and H-beams from ScaffoldPro", done: true },
    { title: "Set out slab soffit level from column kickers", done: true },
    { title: "Fix plywood decking — east bay", done: false },
    { title: "Check prop spacing and camber before rebar goes on", done: false },
  ] },
  { task: "Rebar cage — first floor columns", items: [
    { title: "Cut and bend 12mm main bars", done: true },
    { title: "Tie stirrups at 100mm per SD-04 rev C", done: false },
    { title: "Fix cover blocks and check laps", done: false },
  ] },
  { task: "Order roofing accessories", items: [
    { title: "Confirm ridge, valley and drip-edge quantities off the roof plan", done: true },
    { title: "Issue the PO amendment to Roofmasters", done: false },
  ] },
  { task: "Confirm tile selections with client", items: [
    { title: "Send matte and polished samples to the owner", done: true },
    { title: "Confirm the master bathroom tile against the selection sheet", done: false },
    { title: "Record the decision and release the order", done: false },
  ] },
  { task: "Award electrical subcontract", items: [
    { title: "Level the three bids onto one comparison sheet", done: true },
    { title: "Check references on the two lowest bids", done: false },
    { title: "Obtain the owner's sign-off on the award", done: false },
  ] },
  { task: "Draft roofing method statement", items: [
    { title: "Write the sequence and edge-protection plan", done: false },
    { title: "Circulate to Arup and the roofing crew for comment", done: false },
  ] },
];

// Sequence on site: shuttering, then the slab and column steel, then the
// engineer's inspection before anything is poured.
const TASK_LINKS: { source: string; target: string; type: string }[] = [
  { source: "Slab shuttering — first floor", target: "Rebar cage — first floor columns", type: "blocks" },
  { source: "Book structural inspection — first floor", target: "Rebar cage — first floor columns", type: "blocked_by" },
  { source: "Book structural inspection — first floor", target: "Slab shuttering — first floor", type: "blocked_by" },
  { source: "Draft roofing method statement", target: "Order roofing accessories", type: "relates_to" },
];

// Only the entity types the tasks module can still resolve a label for —
// action_item links are accepted by the CHECK but render as "(deleted)".
const ENTITY_LINKS: { task: string; type: string; ref: string }[] = [
  { task: "Rebar cage — first floor columns", type: "rfi", ref: "rfi:1" },
  { task: "Rebar cage — first floor columns", type: "milestone_payment", ref: "m4" },
  { task: "Confirm tile selections with client", type: "change_request", ref: "chg1" },
  { task: "Slab shuttering — first floor", type: "invoice", ref: "invoice:SUB-INV-2026-012" },
  { task: "Order roofing accessories", type: "material", ref: "mo-seed-1" },
];

const DISTRIBUTION: { rfi: number; name: string; email: string | null; role: string }[] = [
  { rfi: 1, name: "Dr. Angela Bello", email: "abello@arup.com", role: "responder" },
  { rfi: 1, name: "Arinze Obi", email: "arinze.obi@buildpanda.demo", role: "viewer" },
  { rfi: 2, name: "Adeyi Client", email: "adeyi.client@buildpanda.demo", role: "responder" },
  { rfi: 2, name: "Dr. Angela Bello", email: "abello@arup.com", role: "viewer" },
  { rfi: 2, name: "Arinze Obi", email: "arinze.obi@buildpanda.demo", role: "viewer" },
  { rfi: 3, name: "Interior architect", email: null, role: "responder" },
  { rfi: 3, name: "Engr. David Okonjo", email: "david.okonjo@buildpanda.demo", role: "viewer" },
];

// d2 is Main_Structure_RevB.dwg — the drawing both of these RFIs are raised
// against. RFI 2 (waterproofing spec) has no drawing in the fixture to anchor.
const RFI_LINKS: { rfi: number; targetType: string; targetId: string }[] = [
  { rfi: 1, targetType: "document", targetId: "d2" },
  { rfi: 3, targetType: "document", targetId: "d2" },
];

interface RfiEventSpec {
  rfi: number;
  type: string;
  actorId: string | null;
  actorLabel: string | null;
  detail: Record<string, unknown> | null;
  days: number;
}

// The trail the rfis service would have written: created → opened → routed →
// distributed → answered, on the same dates the RFI rows already carry.
const RFI_EVENTS: RfiEventSpec[] = [
  { rfi: 1, type: "created", actorId: "seed-eng", actorLabel: "Engr. David Okonjo", detail: { number: 1 }, days: 12 },
  { rfi: 1, type: "opened", actorId: "seed-eng", actorLabel: "Engr. David Okonjo", detail: null, days: 12 },
  { rfi: 1, type: "ball_in_court_changed", actorId: "seed-pm", actorLabel: "Site Manager", detail: { to: "Dr. Angela Bello" }, days: 12 },
  { rfi: 1, type: "distribution_added", actorId: "seed-pm", actorLabel: "Site Manager", detail: { name: "Dr. Angela Bello", role: "responder" }, days: 11 },
  { rfi: 1, type: "answered", actorId: "seed-eng", actorLabel: "Dr. Angela Bello", detail: null, days: 8 },
  { rfi: 2, type: "created", actorId: "seed-pm", actorLabel: "Site Manager", detail: { number: 2 }, days: 5 },
  { rfi: 2, type: "opened", actorId: "seed-pm", actorLabel: "Site Manager", detail: null, days: 5 },
  { rfi: 2, type: "distribution_added", actorId: "seed-pm", actorLabel: "Site Manager", detail: { name: "Adeyi Client", role: "responder" }, days: 5 },
  { rfi: 2, type: "ball_in_court_changed", actorId: "seed-pm", actorLabel: "Site Manager", detail: { to: "Client (Mr. Adeyi)" }, days: 4 },
  { rfi: 3, type: "created", actorId: "seed-eng", actorLabel: "Engr. David Okonjo", detail: { number: 3 }, days: 2 },
  { rfi: 3, type: "opened", actorId: "seed-eng", actorLabel: "Engr. David Okonjo", detail: null, days: 2 },
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;

  if (await knex.schema.hasTable("team_members")) {
    await knex("team_members").where({ project_id: PROJECT_ID }).del();
    await knex("team_members").insert(
      TEAM.map((member, index) => ({
        id: `tm-seed-${index + 1}`,
        project_id: PROJECT_ID,
        name: member.name,
        role: member.role,
        company: member.company,
        email: member.email,
        phone: member.phone,
        responsibilities: member.responsibilities,
        status: member.status,
        // The roster lists newest first, so the lead contractor needs the most
        // recent created_at to sit at the top of it.
        created_at: daysAgo(index + 1),
      })),
    );
  }

  const taskRows = await knex("tasks")
    .where({ project_id: PROJECT_ID })
    .select<{ id: string; title: string }[]>("id", "title");
  const taskIdByTitle = new Map(taskRows.map((row) => [row.title, row.id]));
  const taskIds = taskRows.map((row) => row.id);

  if (taskIds.length > 0 && (await knex.schema.hasTable("task_subtasks"))) {
    await knex("task_subtasks").whereIn("task_id", taskIds).del();
    const rows: Record<string, unknown>[] = [];
    let seq = 0;
    for (const group of SUBTASKS) {
      const taskId = taskIdByTitle.get(group.task);
      if (!taskId) continue;
      group.items.forEach((item, position) => {
        rows.push({
          id: `sub-seed-${++seq}`,
          task_id: taskId,
          title: item.title,
          done: item.done,
          position,
          created_at: daysAgo(6),
        });
      });
    }
    if (rows.length > 0) await knex("task_subtasks").insert(rows);
  }

  if (taskIds.length > 0 && (await knex.schema.hasTable("task_links"))) {
    await knex("task_links").where({ project_id: PROJECT_ID }).del();
    const rows = TASK_LINKS.flatMap((link, index) => {
      const source = taskIdByTitle.get(link.source);
      const target = taskIdByTitle.get(link.target);
      if (!source || !target) return [];
      return [{
        id: `tlink-seed-${index + 1}`,
        project_id: PROJECT_ID,
        source_task_id: source,
        target_task_id: target,
        link_type: link.type,
        created_by_id: null,
        created_at: daysAgo(7),
      }];
    });
    if (rows.length > 0) await knex("task_links").insert(rows);
  }

  if (taskIds.length > 0 && (await knex.schema.hasTable("task_entity_links"))) {
    await knex("task_entity_links").where({ project_id: PROJECT_ID }).del();
    const [rfiRows, invoiceRows] = await Promise.all([
      knex("rfis").where({ project_id: PROJECT_ID }).select<{ id: string; number: number }[]>("id", "number"),
      knex("project_invoices").where({ project_id: PROJECT_ID }).select<{ id: string; number: string }[]>("id", "number"),
    ]);
    const rfiIdByNumber = new Map(rfiRows.map((row) => [`rfi:${row.number}`, row.id]));
    const invoiceIdByNumber = new Map(invoiceRows.map((row) => [`invoice:${row.number}`, row.id]));
    const rows = ENTITY_LINKS.flatMap((link, index) => {
      const taskId = taskIdByTitle.get(link.task);
      // A "rfi:"/"invoice:" ref that resolved to nothing would be stored as a
      // dangling id and render as "(deleted)" in the drawer.
      const lookedUp = rfiIdByNumber.get(link.ref) ?? invoiceIdByNumber.get(link.ref);
      const entityId = link.ref.includes(":") ? lookedUp : link.ref;
      if (!taskId || !entityId) return [];
      return [{
        id: `telink-seed-${index + 1}`,
        project_id: PROJECT_ID,
        task_id: taskId,
        entity_type: link.type,
        entity_id: entityId,
        created_by_id: null,
        created_at: daysAgo(5),
      }];
    });
    if (rows.length > 0) await knex("task_entity_links").insert(rows);
  }

  const rfiRows = await knex("rfis")
    .where({ project_id: PROJECT_ID })
    .select<{ id: string; number: number }[]>("id", "number");
  const rfiIds = rfiRows.map((row) => row.id);
  const rfiIdByNumber = new Map(rfiRows.map((row) => [row.number, row.id]));

  if (rfiIds.length > 0 && (await knex.schema.hasTable("rfi_distribution"))) {
    await knex("rfi_distribution").whereIn("rfi_id", rfiIds).del();
    const rows = DISTRIBUTION.flatMap((entry, index) => {
      const rfiId = rfiIdByNumber.get(entry.rfi);
      if (!rfiId) return [];
      return [{
        id: `rfid-seed-${index + 1}`,
        rfi_id: rfiId,
        user_id: null,
        email: entry.email,
        name: entry.name,
        role: entry.role,
        // No reply token: these people were copied in-app, not emailed a
        // one-time external reply link that a demo would leave live.
        reply_token_hash: null,
        token_expires_at: null,
        token_consumed_at: null,
        created_at: daysAgo(5),
      }];
    });
    if (rows.length > 0) await knex("rfi_distribution").insert(rows);
  }

  if (rfiIds.length > 0 && (await knex.schema.hasTable("rfi_links"))) {
    await knex("rfi_links").whereIn("rfi_id", rfiIds).del();
    const rows = RFI_LINKS.flatMap((link, index) => {
      const rfiId = rfiIdByNumber.get(link.rfi);
      if (!rfiId) return [];
      return [{
        id: `rfil-seed-${index + 1}`,
        rfi_id: rfiId,
        target_type: link.targetType,
        target_id: link.targetId,
        target_model_id: null,
        created_at: daysAgo(10),
      }];
    });
    if (rows.length > 0) await knex("rfi_links").insert(rows);
  }

  if (rfiIds.length > 0 && (await knex.schema.hasTable("rfi_events"))) {
    await knex("rfi_events").whereIn("rfi_id", rfiIds).del();
    const rows = RFI_EVENTS.flatMap((event, index) => {
      const rfiId = rfiIdByNumber.get(event.rfi);
      if (!rfiId) return [];
      return [{
        id: `rfev-seed-${index + 1}`,
        rfi_id: rfiId,
        type: event.type,
        actor_id: event.actorId,
        actor_label: event.actorLabel,
        detail: event.detail === null ? null : JSON.stringify(event.detail),
        created_at: daysAgo(event.days),
      }];
    });
    if (rows.length > 0) await knex("rfi_events").insert(rows);
  }

  if (await knex.schema.hasTable("rfi_counters")) {
    // The counter hands out the next reference number and the (project, number)
    // pair is unique, so it must resume above the highest RFI already seeded —
    // reading it back rather than hard-coding 4 keeps it right if the RFI
    // fixture grows.
    const highest = await knex("rfis")
      .where({ project_id: PROJECT_ID })
      .max<{ max: number | string | null }>({ max: "number" })
      .first();
    const next = Number(highest?.max ?? 0) + 1;
    await knex("rfi_counters").where({ project_id: PROJECT_ID }).del();
    await knex("rfi_counters").insert({ project_id: PROJECT_ID, next_number: next });
  }
}
