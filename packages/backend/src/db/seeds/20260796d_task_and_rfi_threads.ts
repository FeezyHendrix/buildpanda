import type { Knex } from "knex";

/**
 * Assignees and comment threads for the sample project's task board and RFIs.
 *
 * 20260775_marbella_modern.ts clears these three tables as part of its own
 * re-run cleanup but never fills them, so the board shipped with nobody's name
 * on it and no record of the conversation behind any task or RFI. It runs
 * before this file, so these inserts survive.
 *
 * task_assignees.assignee_id is a hard foreign key to `user`, so the people
 * here are resolved from real accounts at run time — the demo workspace from
 * 20260100_demo_identity.ts when it is present, otherwise whoever actually
 * exists. Nothing is hardcoded to the demo ids.
 */
const PROJECT_ID = "sample-project";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

interface Person {
  id: string;
  name: string;
}

type CastRole = "pm" | "engineer" | "qs" | "client";

// Assignments are spread over every column so "assigned to me" and the
// per-column views all have something to show, and mix user accounts with
// team_members rows so both kinds of assignee render.
const ASSIGNMENTS: { task: string; users: CastRole[]; team: string[] }[] = [
  { task: "Site handover and setup", users: ["pm"], team: [] },
  { task: "Foundations concrete pour", users: ["engineer"], team: ["Arinze Obi"] },
  { task: "Ground floor block work — east wing", users: [], team: ["Arinze Obi"] },
  { task: "Slab shuttering — first floor", users: ["engineer"], team: ["Ibrahim Danjuma"] },
  { task: "Rebar cage — first floor columns", users: ["engineer"], team: ["Yusuf Adeyemi"] },
  { task: "Order roofing accessories", users: ["qs"], team: [] },
  { task: "Confirm tile selections with client", users: ["pm"], team: [] },
  { task: "Award electrical subcontract", users: ["qs", "pm"], team: [] },
  { task: "Book structural inspection — first floor", users: ["engineer"], team: [] },
  { task: "Draft roofing method statement", users: ["qs"], team: ["Emeka Ibe"] },
];

interface CommentSpec {
  by: CastRole | { team: string };
  body: string;
  days: number;
  proposed?: boolean;
}

// Each thread has to agree with the state its task is in: done work reads as
// closed out, in-progress work ends on the next action, and a todo ends on
// whatever is still holding it.
const TASK_THREADS: { task: string; comments: CommentSpec[] }[] = [
  { task: "Foundations concrete pour", comments: [
    { by: "engineer", body: "Pour completed in one visit. Cube samples taken at the start and the middle of the pour.", days: 32 },
    { by: "engineer", body: "28-day cube results are in and filed against the foundation inspection. Strength is above spec.", days: 4 },
  ] },
  { task: "Slab shuttering — first floor", comments: [
    { by: { team: "Ibrahim Danjuma" }, body: "Props and H-beams landed Tuesday. Soffit is set out off the column kickers; east bay decking goes down tomorrow.", days: 3 },
    { by: "engineer", body: "Prop spacing around the stair void looked tight on my walk. Re-check it against the layout before any steel goes on the deck.", days: 2 },
    { by: "pm", body: "Nobody pours until Arup has walked the finished deck. I have provisionally held Thursday with them.", days: 1 },
  ] },
  { task: "Rebar cage — first floor columns", comments: [
    { by: "engineer", body: "Stirrups go at 100mm, per the answer on RFI 1 and SD-04 rev C. Ignore the 150mm figure still sitting in the BoQ.", days: 7 },
    { by: { team: "Yusuf Adeyemi" }, body: "Mains are cut and bent. Cover blocks are on site, so we can close the cages once the deck is signed off.", days: 2 },
  ] },
  { task: "Order roofing accessories", comments: [
    { by: "qs", body: "Ridge, valley and drip-edge quantities are confirmed off the roof plan. Roofmasters have them for pricing.", days: 3 },
    { by: "qs", body: "PO amendment is drafted but not issued — the sheets on PO-2026-034 are only part delivered, so I want one amendment covering both.", days: 1 },
  ] },
  { task: "Confirm tile selections with client", comments: [
    { by: "pm", body: "Matte and polished samples went out on Monday for the living areas and the master bathroom.", days: 5 },
    { by: "client", body: "Matte for the living areas, as we agreed. Still deciding on the master bathroom — give me until Friday.", days: 3 },
    { by: "pm", body: "Noted. The tiler needs the decision by Friday or the order slips a week behind the cabinet delivery.", days: 2 },
  ] },
  { task: "Award electrical subcontract", comments: [
    { by: "qs", body: "Three bids levelled onto one sheet. The lowest excludes the changeover panel, so it is not like-for-like with the other two.", days: 4 },
    { by: "pm", body: "Agreed — recommending the middle bid. Award is held until the owner signs off.", days: 2 },
  ] },
  { task: "Book structural inspection — first floor", comments: [
    { by: "engineer", body: "Arup can attend Thursday or Friday. I will confirm the day once the cages are closed and the deck is complete.", days: 1 },
  ] },
  { task: "Draft roofing method statement", comments: [
    { by: "qs", body: "Cannot finalise the edge-protection section until the scaffold handover for the roof level is in place.", days: 2 },
  ] },
];

// RFI 1 is Answered, so its thread ends in the response that the RFI row
// already records. RFIs 2 and 3 are Open, so theirs end with the question still
// sitting with the ball-in-court party.
const RFI_THREADS: { rfi: number; comments: CommentSpec[] }[] = [
  { rfi: 1, comments: [
    { by: "pm", body: "Steel is on site and the first cages are part tied. If this is not settled today the bar benders stand down.", days: 11 },
    { by: { team: "Dr. Angela Bello" }, body: "Checked against the issued set: the BoQ was written off rev B and was not reissued when the hoop spacing tightened.", days: 9 },
    { by: { team: "Dr. Angela Bello" }, body: "Use 100mm spacing per revised SD-04 rev C (2026-06-18). Disregard the BoQ value.", days: 8, proposed: true },
    { by: "engineer", body: "Response recorded. Passing it to the bar benders and noting it on the rebar task.", days: 8 },
  ] },
  { rfi: 2, comments: [
    { by: "pm", body: "Two systems priced: a cementitious slurry backed for 10 years, and a liquid-applied polyurethane backed for 20.", days: 4 },
    { by: "qs", body: "The polyurethane is the higher of the two and is not covered by the bathroom allowance. It would need a change request.", days: 3 },
    { by: "client", body: "The 20-year warranty is what I want. Send me the cost difference in writing before I commit.", days: 2 },
  ] },
  { rfi: 3, comments: [
    { by: "engineer", body: "Duct centreline clashes with the beam soffit at grid C-2 by roughly 180mm. It cannot route as drawn.", days: 2 },
    { by: "pm", body: "Either the hood moves 300mm north or the ceiling drops to 2.55m over the run. Both change the kitchen elevation, so it is the architect's call.", days: 1 },
  ] },
];

/**
 * The people records are attributed to. Real accounts win; the demo workspace
 * is only the fallback, and on a database with fewer accounts than roles the
 * roles collapse onto whoever exists rather than inventing a user.
 */
async function resolveCast(knex: Knex): Promise<Record<CastRole, Person> | null> {
  if (!(await knex.schema.hasTable("user"))) return null;
  const rows = await knex("user")
    .orderBy("createdAt", "asc")
    .select<Person[]>("id", "name");
  if (rows.length === 0) return null;

  const pick = (demoId: string, index: number): Person =>
    rows.find((row) => row.id === demoId) ?? rows[Math.min(index, rows.length - 1)]!;

  return {
    pm: pick("usr_demo_pm", 0),
    engineer: pick("usr_demo_engineer", 1),
    qs: pick("usr_demo_qs", 2),
    client: pick("usr_demo_client", 3),
  };
}

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;

  const cast = await resolveCast(knex);

  const teamByName = new Map<string, Person>();
  if (await knex.schema.hasTable("team_members")) {
    const members = await knex("team_members")
      .where({ project_id: PROJECT_ID })
      .select<Person[]>("id", "name");
    for (const member of members) teamByName.set(member.name, member);
  }

  const taskRows = await knex("tasks")
    .where({ project_id: PROJECT_ID })
    .select<{ id: string; title: string }[]>("id", "title");
  const taskIdByTitle = new Map(taskRows.map((row) => [row.title, row.id]));
  const taskIds = taskRows.map((row) => row.id);

  // Resolves a comment author to an id and the name shown against it. Comment
  // author columns are free text, so a team member who holds no account still
  // gets a traceable id — the team_members row itself.
  const author = (by: CommentSpec["by"]): Person | null => {
    if (typeof by === "object") return teamByName.get(by.team) ?? null;
    return cast?.[by] ?? null;
  };

  if (taskIds.length > 0 && cast && (await knex.schema.hasTable("task_assignees"))) {
    await knex("task_assignees").whereIn("task_id", taskIds).del();
    const rows: Record<string, unknown>[] = [];
    for (const assignment of ASSIGNMENTS) {
      const taskId = taskIdByTitle.get(assignment.task);
      if (!taskId) continue;
      // Two roles can resolve to the same account on a one-user database, and
      // (task_id, assignee_id) is unique.
      const seen = new Set<string>();
      for (const role of assignment.users) {
        const person = cast[role];
        if (seen.has(person.id)) continue;
        seen.add(person.id);
        rows.push({
          task_id: taskId,
          assignee_id: person.id,
          assignee_team_member_id: null,
          created_at: daysAgo(8),
        });
      }
      for (const name of assignment.team) {
        const member = teamByName.get(name);
        if (!member) continue;
        rows.push({
          task_id: taskId,
          assignee_id: null,
          assignee_team_member_id: member.id,
          created_at: daysAgo(8),
        });
      }
    }
    if (rows.length > 0) await knex("task_assignees").insert(rows);
  }

  if (taskIds.length > 0 && (await knex.schema.hasTable("task_comments"))) {
    await knex("task_comments").whereIn("task_id", taskIds).del();
    const rows: Record<string, unknown>[] = [];
    let seq = 0;
    for (const thread of TASK_THREADS) {
      const taskId = taskIdByTitle.get(thread.task);
      if (!taskId) continue;
      for (const comment of thread.comments) {
        const person = author(comment.by);
        if (!person) continue;
        rows.push({
          id: `tcmt-seed-${++seq}`,
          task_id: taskId,
          author_id: person.id,
          author_name: person.name,
          body: comment.body,
          created_at: daysAgo(comment.days),
        });
      }
    }
    if (rows.length > 0) await knex("task_comments").insert(rows);
  }

  const rfiRows = await knex("rfis")
    .where({ project_id: PROJECT_ID })
    .select<{ id: string; number: number }[]>("id", "number");
  const rfiIdByNumber = new Map(rfiRows.map((row) => [row.number, row.id]));

  if (rfiRows.length > 0 && (await knex.schema.hasTable("rfi_comments"))) {
    await knex("rfi_comments").whereIn("rfi_id", rfiRows.map((row) => row.id)).del();
    const rows: Record<string, unknown>[] = [];
    let seq = 0;
    for (const thread of RFI_THREADS) {
      const rfiId = rfiIdByNumber.get(thread.rfi);
      if (!rfiId) continue;
      for (const comment of thread.comments) {
        const person = author(comment.by);
        if (!person) continue;
        rows.push({
          id: `rfic-seed-${++seq}`,
          rfi_id: rfiId,
          author_id: person.id,
          author_name: person.name,
          body: comment.body,
          // The one comment the consultant put forward as the answer, which is
          // the text the RFI row already carries as its official response.
          is_proposed_response: comment.proposed === true,
          created_at: daysAgo(comment.days),
          content_html: null,
          attachments: null,
          references: null,
        });
      }
    }
    if (rows.length > 0) await knex("rfi_comments").insert(rows);
  }
}
