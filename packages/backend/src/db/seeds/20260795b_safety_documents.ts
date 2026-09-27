import type { Knex } from "knex";

/**
 * Pre-construction safety pack for the Sample Project: the method statements
 * and the construction phase plan a principal contractor has to hold before
 * anyone works at height on a Lagos duplex. Split out of
 * 20260795_materials_and_quality.ts only to stay under the 400-line ceiling;
 * it owns method_statements and construction_phase_plans for this project.
 */

const PROJECT_ID = "sample-project";

interface MethodStep {
  order: number;
  text: string;
  controls: string;
  ppe: string;
}

interface MethodStatementSpec {
  id: string;
  activityName: string;
  activityId: string | null;
  hazards: string[];
  steps: MethodStep[];
  origin: "ai" | "manual" | "prompt";
  status: "draft" | "edited" | "confirmed";
  confirmedDaysAgo: number | null;
}

/**
 * One statement per work front that is live or next on the programme, at the
 * three lifecycle points the page has to render: an AI draft a person has
 * confirmed, an AI draft still being edited, and a hand-written draft.
 */
const METHOD_STATEMENTS: MethodStatementSpec[] = [
  {
    id: "ms-seed-slab",
    activityName: "Suspended slab formwork and pour — first floor",
    activityId: "act-2",
    hazards: [
      "Falls from the slab edge during deck-out",
      "Formwork or prop collapse under wet concrete load",
      "Falling objects onto the ground-floor works below",
      "Skin burns and eye damage from wet cement",
    ],
    steps: [
      {
        order: 1,
        text: "Set out and erect props to the approved falsework drawing, at 1.2m centres with sole plates on a compacted base.",
        controls: "Falsework design checked by Arup; props tagged and register kept by the Site Manager.",
        ppe: "Helmet, safety boots, gloves, hi-vis",
      },
      {
        order: 2,
        text: "Deck out with 18mm marine plywood and fix double-guardrail edge protection before any operative works within 2m of the edge.",
        controls: "Edge protection inspected and signed off before the deck is released for rebar.",
        ppe: "Helmet, boots, gloves, hi-vis, harness where edge protection is incomplete",
      },
      {
        order: 3,
        text: "Fix the reinforcement cage, then hold the pre-pour inspection with the structural engineer.",
        controls: "No concrete is ordered until the pre-pour inspection is recorded against this activity.",
        ppe: "Helmet, boots, rigger gloves, hi-vis",
      },
      {
        order: 4,
        text: "Pour and vibrate in bays, keeping the pump hose supported and the slab below barricaded.",
        controls: "Exclusion zone under the pour; banksman on the pump; no lone working during the pour.",
        ppe: "Helmet, rubber boots, chemical gloves, goggles, hi-vis",
      },
      {
        order: 5,
        text: "Cure under hessian and water for seven days; strike props only on the engineer's written release.",
        controls: "Cube results at 7 and 28 days filed against the pour before striking.",
        ppe: "Helmet, boots, gloves",
      },
    ],
    origin: "ai",
    status: "confirmed",
    confirmedDaysAgo: 18,
  },
  {
    id: "ms-seed-roof",
    activityName: "Aluzinc roof sheeting — Block A",
    activityId: "act-3",
    hazards: [
      "Falls from the roof perimeter and through fragile openings",
      "Sheets taken by wind during lifting and setting out",
      "Cuts from sheet edges and cutting discs",
      "Heat stress on an exposed roof in Lagos midday sun",
    ],
    steps: [
      {
        order: 1,
        text: "Erect a scaffold with a full edge-protected working platform to the eaves before any operative goes on the roof.",
        controls: "Scaffold handover certificate from ScaffoldPro and weekly re-inspection tags.",
        ppe: "Helmet, boots, gloves, hi-vis",
      },
      {
        order: 2,
        text: "Land sheets in bundles on the purlins with the crane; never store loose sheets on the slope.",
        controls: "Stop lifting above 25km/h wind; banksman controls every lift.",
        ppe: "Helmet, boots, rigger gloves, hi-vis",
      },
      {
        order: 3,
        text: "Fix sheets from the leeward end, working off crawl boards, with harnesses clipped to a running line.",
        controls: "Twin-lanyard harnesses inspected daily; rescue plan briefed before work at height starts.",
        ppe: "Helmet with chinstrap, harness, boots, cut-resistant gloves",
      },
      {
        order: 4,
        text: "Cut sheets at ground level wherever possible; sweep swarf off the roof at the end of every shift.",
        controls: "Hot-works permit for any disc cutting; fire extinguisher at the cutting station.",
        ppe: "Goggles, ear defenders, cut-resistant gloves, boots",
      },
    ],
    origin: "ai",
    status: "edited",
    confirmedDaysAgo: null,
  },
  {
    id: "ms-seed-blockwork",
    activityName: "9-inch sandcrete blockwork to first floor",
    activityId: null,
    hazards: [
      "Manual handling injuries from 9-inch blocks",
      "Falls from trestles and hop-ups at lift height",
      "Silica dust from block cutting",
    ],
    steps: [
      {
        order: 1,
        text: "Stack blocks on the slab in pallets over the beam lines only, at a maximum of four courses.",
        controls: "Loading plan agreed with the engineer so the green slab is not overloaded.",
        ppe: "Helmet, boots, gloves, hi-vis",
      },
      {
        order: 2,
        text: "Build in lifts of no more than 1.2m per day, with the scaffold raised to keep work at waist height.",
        controls: "Two-person lift for wet blocks; rotation to limit repetitive handling.",
        ppe: "Helmet, boots, gloves",
      },
      {
        order: 3,
        text: "Cut blocks wet, downwind of the working area.",
        controls: "On-tool water suppression; no dry cutting on site.",
        ppe: "FFP3 mask, goggles, gloves",
      },
    ],
    origin: "manual",
    status: "draft",
    confirmedDaysAgo: null,
  },
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;

  // confirmed_by and created_by are FKs onto `user`, and the seeded actors
  // ("seed-pm", "seed-eng") are free-text display ids with no row behind them.
  // The first real signed-up account stands in; on a fresh database it is null
  // and the rows still insert.
  const actor = await knex("user")
    .whereNot("id", "like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string }>("id");
  const actorId = actor?.id ?? null;
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  if (await knex.schema.hasTable("method_statements")) {
    await knex("method_statements").where({ project_id: PROJECT_ID }).del();
    await knex("method_statements").insert(
      METHOD_STATEMENTS.map((ms) => ({
        id: ms.id,
        proposal_id: null,
        project_id: PROJECT_ID,
        activity_name: ms.activityName,
        programme_task_id: null,
        activity_id: ms.activityId,
        // jsonb is written as a string so pg never reads the array as a
        // Postgres array literal.
        hazards: JSON.stringify(ms.hazards),
        steps: JSON.stringify(ms.steps),
        origin: ms.origin,
        status: ms.status,
        confirmed_by: ms.confirmedDaysAgo === null ? null : actorId,
        confirmed_at: ms.confirmedDaysAgo === null ? null : daysAgo(ms.confirmedDaysAgo),
        created_by: actorId,
      })),
    );
  }

  if (await knex.schema.hasTable("construction_phase_plans")) {
    await knex("construction_phase_plans").where({ project_id: PROJECT_ID }).del();
    await knex("construction_phase_plans").insert({
      id: "cpp-seed-sample",
      proposal_id: null,
      project_id: PROJECT_ID,
      key_dates_note:
        "Foundation complete Feb 2026. Structural shell to 30 Apr 2026. Roofing and MEP May–Jun 2026, which puts the roof works inside the Lagos rainy season — sheeting is programmed for dry-window mornings.",
      site_rules:
        "Site opens 07:00 and closes 18:00, no Sunday working without written notice to the estate. Helmet, boots and hi-vis at all times past the gate. All visitors sign in at the cabin and are escorted. No alcohol, no smoking outside the designated point, no music on the working deck.",
      welfare:
        "Two chemical WCs and a washing station at the gate, restocked twice weekly. Drinking water coolers on the ground floor and at the scaffold base. Shaded rest area with seating for the 12-person crew; 30-minute break enforced between 12:30 and 14:00 during the hot season.",
      first_aid:
        "Two trained first-aiders on site (Site Manager and the steel-fixing foreman). First-aid box in the cabin, eye-wash station beside the mixing bay, burns kit for cement contact. Nearest A&E: Lagoon Hospital, Victoria Island — 15 minutes, route posted in the cabin.",
      services_isolation:
        "Ikeja Electric supply isolated at the estate pillar; site runs off a 27kVA generator with a locked-off changeover. Underground water main to the estate marked in blue paint before any excavation. Permit to dig signed by the Site Manager for every excavation past 300mm.",
      asbestos_note:
        "Greenfield plot, no demolition in scope, so no asbestos survey is required. If any buried fragment or imported fill is disturbed, stop work and notify the Site Manager before it is moved.",
      hazards: JSON.stringify([
        "Work at height — scaffold, slab edges and roof sheeting",
        "Falsework and formwork collapse during suspended slab pours",
        "Mobile crane and concrete pump operations in a tight estate plot",
        "Deep excavation and buried estate services",
        "Rainy-season flooding of the excavation and slip hazards on the deck",
        "Public and neighbour interface — estate road shared with residents",
        "Manual handling of blocks, rebar and cement",
        "Silica dust from block and tile cutting",
      ]),
      supervision:
        "The Site Manager is on site full time as the principal contractor's appointed representative. Engr. David Okonjo (Ove Arup) inspects at each pre-pour hold point and signs the release to strike. Daily briefing at 07:15; toolbox talk every Monday, recorded in the daily log. Subcontractor foremen report to the Site Manager before starting any new work front.",
      emergency_contacts: JSON.stringify([
        { name: "Site Manager", role: "Site Manager / first-aider", phone: "+234 803 500 1177" },
        { name: "Engr. David Okonjo", role: "Structural Engineer (Ove Arup)", phone: "+234 703 220 5544" },
        { name: "Lagoon Hospital VI", role: "Nearest A&E", phone: "+234 1 461 0531" },
        { name: "Lagos State Emergency (LASEMA)", role: "Emergency services", phone: "767" },
        { name: "Lagos State Fire Service", role: "Fire", phone: "+234 805 522 0012" },
        { name: "Sentinel Security", role: "Site security, out of hours", phone: "+234 810 552 7788" },
      ]),
      origin: "ai",
      status: "confirmed",
      confirmed_by: actorId,
      confirmed_at: daysAgo(26),
    });
  }
}
