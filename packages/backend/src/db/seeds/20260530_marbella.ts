import type { Knex } from "knex";

const PROJECT_ID = "marbella";

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
    name: "Project Marbella",
    address: "30, John great court, Lekki, Lagos state",
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
    { id: "p1", project_id: PROJECT_ID, name: "Foundation", status: "Done", date_range: "Jan – Feb", sort_order: 0 },
    { id: "p2", project_id: PROJECT_ID, name: "Structural Shell", status: "InProgress", date_range: "Mar – Apr", sort_order: 1 },
    { id: "p3", project_id: PROJECT_ID, name: "Roofing & MEP", status: "Pending", date_range: "May – Jun", sort_order: 2 },
    { id: "p4", project_id: PROJECT_ID, name: "Interior Fit", status: "Pending", date_range: "Jul – Aug", sort_order: 3 },
    { id: "p5", project_id: PROJECT_ID, name: "Completion", status: "Pending", date_range: "Sep – Oct", sort_order: 4 },
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
    { id: "cat-land", name: "Land Documents", tone: "amber" },
    { id: "cat-architectural", name: "Architectural Plans", tone: "brand" },
    { id: "cat-contracts", name: "Contracts & Agreements", tone: "purple" },
    { id: "cat-invoices", name: "Invoices & Receipts", tone: "green" },
    { id: "cat-approvals", name: "Government Approvals", tone: "red" },
    { id: "cat-inspections", name: "Inspection Certs", tone: "orange" },
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

  await knex("material_procurements").insert([
    { id: "mp1", project_id: PROJECT_ID, name: "16mm Reinforcement Steel", purchased_at: "11-04-2026, 11:12 AM", receipt: "reciept_INV-4029.jpeg", amount: 8_880_000, thumbnail_tone: "brand", sort_order: 0 },
    { id: "mp2", project_id: PROJECT_ID, name: "Dangote Grade 42.5 Cement", purchased_at: "10-04-2026, 11:12 AM", receipt: "reciept_INV-4028.jpeg", amount: 4_880_000, thumbnail_tone: "amber", sort_order: 1 },
    { id: "mp3", project_id: PROJECT_ID, name: "Dangote Grade 32.5 Cement", purchased_at: "10-04-2026, 9:12 AM", receipt: "reciept_INV-4027.jpeg", amount: 3_780_000, thumbnail_tone: "orange", sort_order: 2 },
    { id: "mp4", project_id: PROJECT_ID, name: "Dangote Grade 32.5 Cement", purchased_at: "10-04-2026, 9:12 AM", receipt: "reciept_INV-4027.jpeg", amount: 3_780_000, thumbnail_tone: "orange", sort_order: 3 },
    { id: "mp5", project_id: PROJECT_ID, name: "Dangote Grade 32.5 Cement", purchased_at: "10-04-2026, 9:12 AM", receipt: "reciept_INV-4027.jpeg", amount: 3_780_000, thumbnail_tone: "orange", sort_order: 4 },
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
