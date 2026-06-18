import type { Knex } from "knex";

const PROJECT_ID = "sample-project";

const MEDIA_URLS = [
  "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=640&q=70",
];

function mediaUrl(seed: number, offset: number): string {
  return MEDIA_URLS[(seed + offset) % MEDIA_URLS.length]!;
}

export async function seed(knex: Knex): Promise<void> {
  await knex("projects").where({ id: PROJECT_ID }).del();
  await knex("document_categories").del();

  await knex("projects").insert({
    id: PROJECT_ID,
    owner_id: null,
    name: "Sample Project",
    address: "123 Example Street, Sample City",
    status: "On Track",
    health_score: 92,
    risk: "Low",
    progress_percent: 12,
    budget_total: 45_000_000,
    budget_used: 3_300_500,
    currency: "NGN",
    pending_approvals: 2,
    next_inspection_type: "Structural Integrity",
    next_inspection_date: "April 12",
    folder_tone: "orange",
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  });

  await knex("project_phases").insert([
    { id: "p1", project_id: PROJECT_ID, name: "Foundation", status: "Done", date_range: "Jan – Feb", start_date: "2026-01-06", end_date: "2026-02-27", progress_percent: 100, sort_order: 0 },
    { id: "p2", project_id: PROJECT_ID, name: "Structural Shell", status: "InProgress", date_range: "Mar – Apr", start_date: "2026-03-02", end_date: "2026-04-30", progress_percent: 45, sort_order: 1 },
    { id: "p3", project_id: PROJECT_ID, name: "Roofing & MEP", status: "Pending", date_range: "May – Jun", start_date: "2026-05-01", end_date: "2026-06-30", progress_percent: 0, sort_order: 2 },
    { id: "p4", project_id: PROJECT_ID, name: "Interior Fit", status: "Pending", date_range: "Jul – Aug", start_date: "2026-07-01", end_date: "2026-08-31", progress_percent: 0, sort_order: 3 },
    { id: "p5", project_id: PROJECT_ID, name: "Completion", status: "Pending", date_range: "Sep – Oct", start_date: "2026-09-01", end_date: "2026-10-31", progress_percent: 0, sort_order: 4 },
  ]);

  await knex("action_items").insert([
    {
      id: "ai1",
      project_id: PROJECT_ID,
      title: "Resolve boundary setback with town planning",
      description: "Survey shows the east wall is 0.4m inside the required setback. Confirm with the planning office before block work continues.",
      status: "InProgress",
      priority: "High",
      assignee_id: null,
      due_date: "2026-04-18",
      created_by_id: null,
    },
    {
      id: "ai2",
      project_id: PROJECT_ID,
      title: "Confirm rebar grade for first-floor slab",
      description: "Structural engineer to confirm whether Y12 or Y16 is specified for the suspended slab.",
      status: "Open",
      priority: "Urgent",
      assignee_id: null,
      due_date: "2026-04-10",
      created_by_id: null,
    },
    {
      id: "ai3",
      project_id: PROJECT_ID,
      title: "Order waterproofing membrane for roof",
      description: "Lead time is ~3 weeks; place the order before roofing stage begins.",
      status: "Open",
      priority: "Medium",
      assignee_id: null,
      due_date: "2026-04-25",
      created_by_id: null,
    },
    {
      id: "ai4",
      project_id: PROJECT_ID,
      title: "Snag list from foundation inspection",
      description: "Two minor honeycombing spots patched and re-checked.",
      status: "Resolved",
      priority: "Low",
      assignee_id: null,
      due_date: null,
      resolved_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_by_id: null,
    },
  ]);

  await knex("action_item_comments").insert([
    { id: "aic1", action_item_id: "ai1", author_id: "seed-pm", author_name: "Site Manager", body: "Booked a meeting with the planning office for next week.", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "aic2", action_item_id: "ai2", author_id: "seed-eng", author_name: "Engr. David Okonjo", body: "Checking the structural drawings, will confirm by Friday.", created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  ]);

  await knex("queries").insert([
    {
      id: "q1",
      project_id: PROJECT_ID,
      subject: "Which tile finish for the living areas?",
      question: "Owner is deciding between matte and polished porcelain for the ground floor.",
      status: "Answered",
      answer: "Go with matte porcelain — better slip resistance for a family home.",
      due_date: "2026-05-10",
      asked_by_id: null,
      answered_by_id: null,
      answered_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "q2",
      project_id: PROJECT_ID,
      subject: "Position of the kitchen plumbing stack",
      question: "Can the soil stack move 300mm to clear the proposed island? Need confirmation before slab pour.",
      status: "Open",
      answer: null,
      due_date: "2026-04-15",
      asked_by_id: null,
      answered_by_id: null,
    },
    {
      id: "q3",
      project_id: PROJECT_ID,
      subject: "Generator vs inverter sizing",
      question: "What backup capacity should we plan the changeover panel for?",
      status: "Closed",
      answer: "Plan for a 10kVA inverter with solar; no diesel generator required.",
      due_date: null,
      asked_by_id: null,
      answered_by_id: null,
      answered_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  await knex("query_comments").insert([
    { id: "qc1", query_id: "q1", author_id: "seed-owner", author_name: "Homeowner", body: "Agreed, matte it is. Thank you.", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "qc2", query_id: "q2", author_id: "seed-pm", author_name: "Site Manager", body: "Awaiting the architect's revised plumbing layout.", created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  ]);

  await knex("approvals").insert([
    {
      id: "apr1",
      project_id: PROJECT_ID,
      title: "Living room tile selection",
      category: "Finishes",
      description: "Matte porcelain, 600x600, light grey. Sample submitted for sign-off.",
      status: "Approved",
      response: "Approved. Proceed with the matte porcelain as sampled.",
      due_date: "2026-05-08",
      submitted_by_id: null,
      reviewed_by_id: null,
      reviewed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "apr2",
      project_id: PROJECT_ID,
      title: "Bathroom fittings specification",
      category: "Fittings",
      description: "Proposed brand and model list for all three bathrooms.",
      status: "Pending",
      response: null,
      due_date: "2026-05-20",
      submitted_by_id: null,
      reviewed_by_id: null,
    },
    {
      id: "apr3",
      project_id: PROJECT_ID,
      title: "External wall paint colour",
      category: "Finishes",
      description: "Off-white with charcoal trim.",
      status: "Resubmit",
      response: "Owner prefers a warmer tone — please resubmit with a cream option.",
      due_date: "2026-06-01",
      submitted_by_id: null,
      reviewed_by_id: null,
      reviewed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  await knex("approval_comments").insert([
    { id: "aprc1", approval_id: "apr1", author_id: "seed-owner", author_name: "Homeowner", body: "Looks great, happy to proceed.", created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
  ]);

  await knex("change_requests").insert([
    {
      id: "chg1",
      project_id: PROJECT_ID,
      title: "Upgrade ground-floor flooring to imported porcelain",
      description: "Owner requested a higher-grade imported tile for the living and dining areas.",
      reason: "Owner preference / finish upgrade",
      status: "Approved",
      cost_impact: "850000.00",
      time_impact_days: 7,
      currency: "NGN",
      submitted_by_id: null,
      decided_by_id: null,
      decided_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "chg2",
      project_id: PROJECT_ID,
      title: "Add a study partition on the first floor",
      description: "Convert part of the landing into an enclosed study.",
      reason: "Scope addition",
      status: "Submitted",
      cost_impact: "1200000.00",
      time_impact_days: 10,
      currency: "NGN",
      submitted_by_id: null,
    },
  ]);

  await knex("change_request_comments").insert([
    { id: "chgc1", change_request_id: "chg1", author_id: "seed-pm", author_name: "Site Manager", body: "Cost confirmed with the tiler; proceeding.", created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
  ]);

  await knex("permits").insert([
    {
      id: "permit1",
      project_id: PROJECT_ID,
      title: "Building permit",
      authority: "Lagos State Building Control Agency (LASBCA)",
      reference_no: "LASBCA/2026/04821",
      status: "Approved",
      applied_date: "2025-11-10",
      approved_date: "2026-01-04",
      expiry_date: "2027-01-04",
      notes: "Approved for the full 4-bedroom duplex scope.",
    },
    {
      id: "permit2",
      project_id: PROJECT_ID,
      title: "Town planning approval",
      authority: "Lekki Town Planning Authority",
      reference_no: "LTPA/2026/1190",
      status: "Applied",
      applied_date: "2026-02-15",
      approved_date: null,
      expiry_date: null,
      notes: "Awaiting site assessment visit.",
    },
    {
      id: "permit3",
      project_id: PROJECT_ID,
      title: "Environmental impact clearance",
      authority: "Lagos State Ministry of Environment",
      reference_no: null,
      status: "NotStarted",
      applied_date: null,
      approved_date: null,
      expiry_date: null,
      notes: "Required before external works begin.",
    },
  ]);

  await knex("key_dates").insert([
    { id: "kd1", project_id: PROJECT_ID, label: "Foundation complete", target_date: "2026-02-25", actual_date: "2026-02-27", status: "Met", notes: null, sort_order: 0 },
    { id: "kd2", project_id: PROJECT_ID, label: "Roof on (weathertight)", target_date: "2026-06-20", actual_date: null, status: "Upcoming", notes: null, sort_order: 1 },
    { id: "kd3", project_id: PROJECT_ID, label: "Move-in target", target_date: "2026-10-31", actual_date: null, status: "Upcoming", notes: "Owner relocating from the UK.", sort_order: 2 },
  ]);

  await knex("project_participants").insert([
    {
      id: "pp1",
      project_id: PROJECT_ID,
      user_id: null,
      email: "homeowner@example.com",
      role: "client",
      status: "invited",
      invited_by_id: null,
      invite_token: "seed-invite-token-marbella",
      invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const updates = [
    {
      id: "u1",
      author: { id: "person-arinze", name: "Arinze Obi", role: "Lead Contractor", tone: "orange" },
      category: "Progress",
      title: "Roofing installation started",
      description:
        "Roof framing complete, sheets being installed, and trusses being secured by the structural crew.",
      cta: { label: "Approve", tone: "primary" },
      secondary: "Verify with Panda AI",
      created: "2026-04-21T10:15:00Z",
      media: [
        { type: "photo", url: mediaUrl(0, 0) },
        { type: "photo", url: mediaUrl(0, 1) },
        { type: "video", url: mediaUrl(0, 2) },
      ],
    },
    {
      id: "u2",
      author: { id: "person-tunde", name: "Tunde Bakare", role: "Site Inspector", tone: "brand" },
      category: "Material Delivery",
      title: "Plumbing fixtures delivered",
      description:
        "German supplier fixtures inspected on-site, sorted by floor, and stored in the secure container.",
      cta: { label: "Mark as Inspected", tone: "primary" },
      secondary: "View Report",
      created: "2026-04-20T14:30:00Z",
      media: [
        { type: "photo", url: mediaUrl(2, 0) },
        { type: "photo", url: mediaUrl(2, 1) },
      ],
    },
    {
      id: "u3",
      author: { id: "person-david", name: "Engr. David Okonjo", role: "Structural Engineer", tone: "purple" },
      category: "Inspections",
      title: "Structural Integrity Inspection – Foundation Phase",
      description:
        "Concrete strength tests and reinforcement alignment verified across all foundation grids.",
      cta: { label: "Approve", tone: "primary" },
      secondary: "View Report",
      created: "2026-04-19T09:00:00Z",
      media: [],
    },
    {
      id: "u4",
      author: { id: "person-tunde", name: "Tunde Bakare", role: "Site Inspector", tone: "brand" },
      category: "Issues",
      title: "Drainage Blockage at North Perimeter",
      description:
        "Heavy rainfall caused the perimeter trench to block; landscaping crew paused until cleared.",
      cta: { label: "View Resolution Plan", tone: "secondary" },
      secondary: "Escalation Details",
      created: "2026-04-18T16:45:00Z",
      media: [
        { type: "photo", url: mediaUrl(1, 0) },
        { type: "photo", url: mediaUrl(1, 1) },
      ],
    },
  ] as const;

  await knex("project_updates").insert(
    updates.map((u) => ({
      id: u.id,
      project_id: PROJECT_ID,
      author_id: u.author.id,
      author_name: u.author.name,
      author_role: u.author.role,
      author_initials_tone: u.author.tone,
      category: u.category,
      title: u.title,
      description: u.description,
      cta_label: u.cta.label,
      cta_tone: u.cta.tone,
      secondary_action_label: u.secondary,
      created_at: u.created,
    })),
  );

  const updateMedia = updates.flatMap((u) =>
    u.media.map((m, idx) => ({
      id: `${u.id}-m${idx}`,
      update_id: u.id,
      type: m.type,
      url: m.url,
      sort_order: idx,
    })),
  );
  if (updateMedia.length) await knex("update_media").insert(updateMedia);

  await knex("document_categories").insert([
    { id: "cat-land", name: "Land Documents", tone: "amber", group: "document" },
    { id: "cat-contracts", name: "Contracts & Agreements", tone: "purple", group: "document" },
    { id: "cat-invoices", name: "Invoices & Receipts", tone: "green", group: "document" },
    { id: "cat-approvals", name: "Government Approvals", tone: "red", group: "document" },
    { id: "cat-inspections", name: "Inspection Certs", tone: "orange", group: "document" },
    // Plan disciplines (shown under the Plans tab).
    { id: "cat-architectural", name: "Architectural", tone: "brand", group: "plan" },
    { id: "cat_plan_structural", name: "Structural", tone: "orange", group: "plan" },
    { id: "cat_plan_mep", name: "MEP", tone: "green", group: "plan" },
    { id: "cat_plan_civil", name: "Civil / Site", tone: "purple", group: "plan" },
    { id: "cat_plan_survey", name: "Survey", tone: "amber", group: "plan" },
  ]);

  const documents = [
    { id: "d1", category_id: "cat-land", file_name: "C_of_O_Lagos_Villa.pdf", size: "4.2 MB", status: "Verified", uploaded_at: "Oct 24, 2023" },
    { id: "d2", category_id: "cat-architectural", file_name: "Main_Structure_RevB.dwg", size: "4.2 MB", status: "Pending", uploaded_at: "Oct 24, 2023" },
    { id: "d3", category_id: "cat-approvals", file_name: "Env_Impact_Permit_2023.jpg", size: "4.2 MB", status: "Verified", uploaded_at: "Oct 24, 2023" },
    { id: "d4", category_id: "cat-inspections", file_name: "Site_Inspection_Q4.pdf", size: "4.2 MB", status: "Pending", uploaded_at: "Oct 24, 2023" },
    { id: "d5", category_id: "cat-approvals", file_name: "Env_Impact_Permit_2023.pdf", size: "4.2 MB", status: "Expired", uploaded_at: "Oct 24, 2023" },
  ];
  await knex("project_documents").insert(
    documents.map((d) => ({ ...d, project_id: PROJECT_ID })),
  );

  const inspections = [
    {
      id: "i1",
      inspector: { id: "person-david", name: "Engr. David Okonjo", role: "Structural Engineer", tone: "purple" },
      title: "Structural Foundation Check",
      category: "Structural",
      description:
        "Roof framing complete, roofing sheets being installed, trusses secured by the structural crew.",
      status: "Action Required",
      risk_level: "High",
      scheduled_at: "Oct 21, 2023 • 02:15 PM",
      media: [
        { type: "photo", url: mediaUrl(3, 0) },
        { type: "photo", url: mediaUrl(3, 1) },
        { type: "video", url: mediaUrl(3, 2) },
      ],
    },
    {
      id: "i2",
      inspector: { id: "person-david", name: "Engr. David Okonjo", role: "Structural Engineer", tone: "purple" },
      title: "Structural Foundation Check",
      category: "Structural",
      description:
        "Foundation work passed all standard checks. Documentation has been filed with LASBCA.",
      status: "Completed",
      risk_level: "Low",
      scheduled_at: "Oct 21, 2023 • 02:15 PM",
      media: [
        { type: "photo", url: mediaUrl(0, 0) },
        { type: "photo", url: mediaUrl(0, 1) },
        { type: "video", url: mediaUrl(0, 2) },
      ],
    },
  ] as const;

  await knex("inspections").insert(
    inspections.map((i) => ({
      id: i.id,
      project_id: PROJECT_ID,
      inspector_id: i.inspector.id,
      inspector_name: i.inspector.name,
      inspector_role: i.inspector.role,
      inspector_initials_tone: i.inspector.tone,
      title: i.title,
      category: i.category,
      description: i.description,
      status: i.status,
      risk_level: i.risk_level,
      scheduled_at: i.scheduled_at,
      report_url: "#",
    })),
  );

  const inspectionMedia = inspections.flatMap((i) =>
    i.media.map((m, idx) => ({
      id: `${i.id}-m${idx}`,
      inspection_id: i.id,
      type: m.type,
      url: m.url,
      sort_order: idx,
    })),
  );
  if (inspectionMedia.length) await knex("inspection_media").insert(inspectionMedia);

  await knex("project_finances").insert({
    project_id: PROJECT_ID,
    currency: "NGN",
    total_budget: 45_300_500,
    funds_deposited: 23_300_500,
    funds_released: 13_300_500,
    locked_in_escrow: 10_300_500,
    remaining_balance: 3_300_500,
  });

  await knex("budget_phases").insert([
    { id: "ba1", project_id: PROJECT_ID, name: "Foundation", planned: 4_445_000, actual: 4_402_300, sort_order: 0 },
    { id: "ba2", project_id: PROJECT_ID, name: "Superstructure", planned: 8_880_000, actual: 8_888_500, sort_order: 1 },
    { id: "ba3", project_id: PROJECT_ID, name: "Roofing", planned: 6_500_000, actual: 0, sort_order: 2 },
    { id: "ba4", project_id: PROJECT_ID, name: "MEP", planned: 7_200_000, actual: 0, sort_order: 3 },
    { id: "ba5", project_id: PROJECT_ID, name: "Finishing", planned: 9_500_000, actual: 0, sort_order: 4 },
    { id: "ba6", project_id: PROJECT_ID, name: "Contingency", planned: 4_775_500, actual: 0, sort_order: 5 },
  ]);

  await knex("project_budget_categories").insert([
    { id: "bc1", project_id: PROJECT_ID, name: "Substructure", cost_code: "01-100", planned: 4_445_000, committed: 4_445_000, actual: 4_402_300, sort_order: 0 },
    { id: "bc2", project_id: PROJECT_ID, name: "Concrete Frame", cost_code: "03-200", planned: 8_880_000, committed: 8_880_000, actual: 8_888_500, sort_order: 1 },
    { id: "bc3", project_id: PROJECT_ID, name: "Roofing & Waterproofing", cost_code: "07-400", planned: 6_500_000, committed: 3_250_000, actual: 1_120_000, sort_order: 2 },
    { id: "bc4", project_id: PROJECT_ID, name: "Mechanical & Electrical", cost_code: "15-500", planned: 7_200_000, committed: 2_400_000, actual: 0, sort_order: 3 },
    { id: "bc5", project_id: PROJECT_ID, name: "Finishes & Joinery", cost_code: "09-600", planned: 9_500_000, committed: 0, actual: 0, sort_order: 4 },
    { id: "bc6", project_id: PROJECT_ID, name: "Preliminaries & Contingency", cost_code: "00-001", planned: 4_775_500, committed: 1_000_000, actual: 420_000, sort_order: 5 },
  ]);

  await knex("project_budget_periods").insert([
    { id: "bp1", project_id: PROJECT_ID, period: "2026-01", planned: 3_500_000, actual: 3_402_300 },
    { id: "bp2", project_id: PROJECT_ID, period: "2026-02", planned: 5_000_000, actual: 5_120_000 },
    { id: "bp3", project_id: PROJECT_ID, period: "2026-03", planned: 6_500_000, actual: 6_308_500 },
    { id: "bp4", project_id: PROJECT_ID, period: "2026-04", planned: 7_000_000, actual: 0 },
    { id: "bp5", project_id: PROJECT_ID, period: "2026-05", planned: 8_500_000, actual: 0 },
    { id: "bp6", project_id: PROJECT_ID, period: "2026-06", planned: 9_000_000, actual: 0 },
  ]);

  await knex("material_procurements").insert([
    { id: "mp1", project_id: PROJECT_ID, material_order_id: null, name: "16mm Reinforcement Steel", purchased_at: "11-04-2026, 11:12 AM", receipt: "reciept_INV-4029.jpeg", amount: 8_880_000, thumbnail_tone: "brand", sort_order: 0 },
    { id: "mp2", project_id: PROJECT_ID, material_order_id: null, name: "Dangote Grade 42.5 Cement", purchased_at: "10-04-2026, 11:12 AM", receipt: "reciept_INV-4028.jpeg", amount: 4_880_000, thumbnail_tone: "amber", sort_order: 1 },
    { id: "mp3", project_id: PROJECT_ID, material_order_id: null, name: "Dangote Grade 32.5 Cement", purchased_at: "10-04-2026, 9:12 AM", receipt: "reciept_INV-4027.jpeg", amount: 3_780_000, thumbnail_tone: "orange", sort_order: 2 },
    { id: "mp4", project_id: PROJECT_ID, material_order_id: null, name: "Dangote Grade 32.5 Cement", purchased_at: "10-04-2026, 9:12 AM", receipt: "reciept_INV-4027.jpeg", amount: 3_780_000, thumbnail_tone: "orange", sort_order: 3 },
    { id: "mp5", project_id: PROJECT_ID, material_order_id: null, name: "Dangote Grade 32.5 Cement", purchased_at: "10-04-2026, 9:12 AM", receipt: "reciept_INV-4027.jpeg", amount: 3_780_000, thumbnail_tone: "orange", sort_order: 4 },
  ]);

  await knex("milestone_payments").insert([
    {
      id: "m1",
      project_id: PROJECT_ID,
      name: "Main Roof Structure",
      phase: "Roofing",
      status: "Completed",
      percent_complete: 100,
      amount: 8_880_000,
      proof_file_name: "inspection_report_R01.pdf",
      proof_verified: true,
      inspector_sign_off: "Verified",
      sort_order: 0,
    },
    {
      id: "m2",
      project_id: PROJECT_ID,
      name: "Electric Rough-in",
      phase: "Systems",
      status: "InProgress",
      percent_complete: 75,
      amount: 8_880_000,
      proof_file_name: null,
      proof_verified: false,
      inspector_sign_off: "Scheduled",
      sort_order: 1,
    },
    {
      id: "m3",
      project_id: PROJECT_ID,
      name: "Electric Rough-in",
      phase: "Systems",
      status: "Pending",
      percent_complete: 0,
      amount: 0,
      proof_file_name: null,
      proof_verified: false,
      inspector_sign_off: "Pending",
      sort_order: 2,
    },
  ]);

  await knex("payment_ledger").insert([
    { id: "l1", project_id: PROJECT_ID, entry_date: "11-04-2026", description: "Release · Main Roof Structure", amount: 8_880_000, type: "Release", sort_order: 0 },
    { id: "l2", project_id: PROJECT_ID, entry_date: "01-04-2026", description: "Deposit · Project funding", amount: 23_300_500, type: "Deposit", sort_order: 1 },
    { id: "l3", project_id: PROJECT_ID, entry_date: "10-03-2026", description: "Hold · Electric Rough-in (escrow)", amount: 8_880_000, type: "Hold", sort_order: 2 },
  ]);

  await knex("activities").insert([
    {
      id: "act-1",
      project_id: PROJECT_ID,
      phase_id: "p2",
      name: "Column placement — Block A, Floor 2",
      activity_type: "concrete_pour",
      location: "Block A · Floor 2",
      status: "Completed",
      planned_start_at: "2026-04-15T07:00:00Z",
      planned_end_at: "2026-04-18T17:00:00Z",
      actual_start_at: "2026-04-15T07:30:00Z",
      actual_end_at: "2026-04-19T16:00:00Z",
      worker_count_planned: 12,
      notes: "Columns C1-C8 placed and cured.",
    },
    {
      id: "act-2",
      project_id: PROJECT_ID,
      phase_id: "p2",
      name: "Slab pour — Floor 2",
      activity_type: "concrete_pour",
      location: "Block A · Floor 2",
      status: "InProgress",
      planned_start_at: "2026-04-22T07:00:00Z",
      planned_end_at: "2026-04-24T17:00:00Z",
      actual_start_at: "2026-04-23T09:00:00Z",
      actual_end_at: null,
      worker_count_planned: 16,
      notes: null,
    },
    {
      id: "act-3",
      project_id: PROJECT_ID,
      phase_id: "p3",
      name: "Roofing installation — Block A",
      activity_type: "roofing",
      location: "Block A · Roof",
      status: "Planned",
      planned_start_at: "2026-05-05T07:00:00Z",
      planned_end_at: "2026-05-12T17:00:00Z",
      actual_start_at: null,
      actual_end_at: null,
      worker_count_planned: 8,
    },
  ]);

  await knex("material_orders").insert([
    {
      id: "mo-seed-1",
      project_id: PROJECT_ID,
      title: "Roofing sheets for Block A",
      material_name: "Long-span aluminium roofing sheets",
      quantity: 420,
      unit: "sqm",
      supplier: "Lekki Roofing Supplies",
      status: "Ordered",
      priority: "High",
      phase_id: "p3",
      activity_id: "act-3",
      document_id: "d2",
      requested_by_id: null,
      needed_by: "2026-05-04",
      ordered_at: "2026-04-24",
      expected_delivery_at: "2026-05-02",
      delivered_at: null,
      estimated_cost: 5_600_000,
      actual_cost: 0,
      currency: "NGN",
      delivery_location: "Block A roof staging area",
      notes: "Must arrive before roofing installation starts; keep receipt against finance materials.",
    },
    {
      id: "mo-seed-2",
      project_id: PROJECT_ID,
      title: "Concrete pump fuel and spare hose",
      material_name: "Pump hose kit and diesel",
      quantity: 1,
      unit: "lot",
      supplier: "Prime Plant Hire",
      status: "Delivered",
      priority: "Critical",
      phase_id: "p2",
      activity_id: "act-2",
      document_id: "d4",
      requested_by_id: null,
      needed_by: "2026-04-23",
      ordered_at: "2026-04-21",
      expected_delivery_at: "2026-04-23",
      delivered_at: "2026-04-23",
      estimated_cost: 650_000,
      actual_cost: 620_000,
      currency: "NGN",
      delivery_location: "Block A · Floor 2 pour zone",
      notes: "Resolved material-delivery delay risk on slab pour.",
    },
  ]);

  await knex("material_procurements").where({ id: "mp5" }).update({ material_order_id: "mo-seed-2" });

  await knex("equipment_requests").insert([
    {
      id: "er-seed-1",
      project_id: PROJECT_ID,
      title: "Mobile crane for roof trusses",
      equipment_name: "50-ton mobile crane",
      equipment_type: "Lifting equipment",
      quantity: 1,
      supplier: "Prime Plant Hire",
      status: "Approved",
      priority: "High",
      phase_id: "p3",
      activity_id: "act-3",
      document_id: "d2",
      requested_by_id: null,
      needed_from: "2026-05-05",
      needed_until: "2026-05-07",
      mobilized_at: null,
      returned_at: null,
      estimated_cost: 1_450_000,
      actual_cost: 0,
      currency: "NGN",
      delivery_location: "North access crane pad",
      operator_required: "Yes",
      notes: "Schedule after roofing sheets arrive; keep lift plan in documents.",
    },
    {
      id: "er-seed-2",
      project_id: PROJECT_ID,
      title: "Concrete pump hire for slab pour",
      equipment_name: "Trailer-mounted concrete pump",
      equipment_type: "Concrete equipment",
      quantity: 1,
      supplier: "Prime Plant Hire",
      status: "OnHire",
      priority: "Critical",
      phase_id: "p2",
      activity_id: "act-2",
      document_id: "d4",
      requested_by_id: null,
      needed_from: "2026-04-23",
      needed_until: "2026-04-24",
      mobilized_at: "2026-04-23T06:30:00Z",
      returned_at: null,
      estimated_cost: 850_000,
      actual_cost: 0,
      currency: "NGN",
      delivery_location: "Block A · Floor 2 pour zone",
      operator_required: "Yes",
      notes: "Open delay references late arrival; return after final pour washout.",
    },
    {
      id: "er-seed-3",
      project_id: PROJECT_ID,
      title: "Generator backup for site welding",
      equipment_name: "80kVA generator",
      equipment_type: "Power",
      quantity: 1,
      supplier: "Lagos Power Rentals",
      status: "Returned",
      priority: "Normal",
      phase_id: "p2",
      activity_id: "act-1",
      document_id: null,
      requested_by_id: null,
      needed_from: "2026-04-15",
      needed_until: "2026-04-18",
      mobilized_at: "2026-04-15T06:00:00Z",
      returned_at: "2026-04-18T18:30:00Z",
      estimated_cost: 420_000,
      actual_cost: 410_000,
      currency: "NGN",
      delivery_location: "Site electrical yard",
      operator_required: "No",
      notes: "Closed with column placement work package.",
    },
  ]);

  await knex("activity_delays").insert([
    {
      id: "ad-1",
      activity_id: "act-1",
      reason_code: "WEATHER_RAIN",
      description: "Afternoon rainfall delayed column form-stripping.",
      started_at: "2026-04-17T13:00:00Z",
      resolved_at: "2026-04-18T08:00:00Z",
      cost_impact: 180_000,
      currency: "NGN",
      prevention_notes: "Stage tarpaulins by Friday to allow continued work through light showers.",
    },
    {
      id: "ad-2",
      activity_id: "act-2",
      reason_code: "MATERIAL_DELIVERY",
      description: "Concrete pump arrived 2 hours late.",
      started_at: "2026-04-23T07:00:00Z",
      resolved_at: "2026-04-23T09:00:00Z",
      cost_impact: 65_000,
      currency: "NGN",
      prevention_notes: "Confirm pump arrival window 24h ahead.",
    },
  ]);

  await knex("daily_logs").insert([
    {
      project_id: PROJECT_ID,
      log_date: "2026-04-15",
      weather_condition: "Sunny",
      temperature_c: 31,
      precipitation_mm: 0,
      wind_kph: 12,
      workers_expected: 12,
      workers_present: 12,
      total_hours: 96,
      summary: "Columns C1–C4 placed. Full crew on site, no incidents.",
    },
    {
      project_id: PROJECT_ID,
      log_date: "2026-04-17",
      weather_condition: "Rain",
      temperature_c: 27,
      precipitation_mm: 18.5,
      wind_kph: 22,
      workers_expected: 12,
      workers_present: 10,
      total_hours: 60,
      summary: "Rain shut down form-stripping in the afternoon. Crew rotated to indoor finishing prep.",
    },
    {
      project_id: PROJECT_ID,
      log_date: "2026-04-23",
      weather_condition: "Cloudy",
      temperature_c: 29,
      precipitation_mm: 0,
      wind_kph: 9,
      workers_expected: 16,
      workers_present: 16,
      total_hours: 112,
      summary: "Slab pour started after pump arrived. Steel placement verified.",
    },
  ]);

  await knex("daily_log_activities").insert([
    { project_id: PROJECT_ID, log_date: "2026-04-15", activity_id: "act-1", hours_logged: 96 },
    { project_id: PROJECT_ID, log_date: "2026-04-17", activity_id: "act-1", hours_logged: 60 },
    { project_id: PROJECT_ID, log_date: "2026-04-23", activity_id: "act-2", hours_logged: 112 },
  ]);

  await knex("project_updates").where({ id: "u1" }).update({ activity_id: "act-3" });
  await knex("project_updates").where({ id: "u3" }).update({ activity_id: "act-1" });
}
