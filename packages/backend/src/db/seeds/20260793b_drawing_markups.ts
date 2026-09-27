import type { Knex } from "knex";

const PROJECT_ID = "sample-project";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

interface MarkupSpec {
  id: string;
  /**
   * Which revision of the drawing the redline was raised against. A markup on
   * the superseded sheet stays there once a newer revision is issued, which is
   * how the register flags an item nobody has carried forward.
   */
  rev: "current" | "superseded";
  kind: "pin" | "pen" | "cloud" | "measure";
  geometry: Record<string, unknown>;
  color: string;
  daysAgo: number;
  resolvedDaysAgo?: number;
  comments: { id: string; body: string; daysAgo: number }[];
}

/** Brand blue is the default redline; red flags a defect, amber a query. */
const MARKUPS: MarkupSpec[] = [
  {
    id: "dmk_sample_1",
    rev: "current",
    kind: "cloud",
    geometry: { kind: "cloud", rect: { x: 18.5, y: 22.0, w: 21.0, h: 14.5 }, space: "percent" },
    color: "#E5484D",
    daysAgo: 4,
    comments: [
      { id: "dmkc_sample_1", body: "Stair core on the current revision is 150 mm narrower than the shell we have already cast. Confirm which one is right before the flight is fabricated.", daysAgo: 4 },
      { id: "dmkc_sample_2", body: "Checking against the setting-out sheet — will confirm by Thursday.", daysAgo: 3 },
    ],
  },
  {
    id: "dmk_sample_2",
    rev: "current",
    kind: "pin",
    geometry: { kind: "pin", at: { x: 61.2, y: 47.8 }, space: "percent" },
    color: "#004DE7",
    daysAgo: 6,
    comments: [
      { id: "dmkc_sample_3", body: "Blockwork opening for the kitchen window scales at 1500 here but the schedule says 1800. Which governs?", daysAgo: 6 },
      { id: "dmkc_sample_4", body: "Window schedule governs — 1800. Drawing to be corrected on the next issue.", daysAgo: 5 },
    ],
  },
  {
    id: "dmk_sample_3",
    rev: "current",
    kind: "measure",
    geometry: { kind: "measure", a: { x: 24.0, y: 68.0 }, b: { x: 52.5, y: 68.0 }, space: "percent" },
    color: "#F5A524",
    daysAgo: 8,
    resolvedDaysAgo: 7,
    comments: [
      { id: "dmkc_sample_5", body: "Grid C to grid D scales 4.2 m, matches the setting-out. No action.", daysAgo: 7 },
    ],
  },
  {
    id: "dmk_sample_4",
    rev: "current",
    kind: "pen",
    geometry: {
      kind: "pen",
      points: [
        { x: 70.0, y: 18.0 },
        { x: 76.5, y: 21.5 },
        { x: 80.0, y: 29.0 },
        { x: 74.0, y: 33.5 },
      ],
      space: "percent",
    },
    color: "#004DE7",
    daysAgo: 2,
    comments: [
      { id: "dmkc_sample_6", body: "Rear setback measures 2.8 m here. LASBCA approval was granted on 3 m — do not build to this line until it is resolved.", daysAgo: 2 },
    ],
  },
  {
    id: "dmk_sample_5",
    rev: "superseded",
    kind: "pin",
    geometry: { kind: "pin", at: { x: 38.0, y: 55.0 }, space: "percent" },
    color: "#E5484D",
    daysAgo: 34,
    comments: [
      { id: "dmkc_sample_7", body: "Rebar spacing in the ground beam detail reads 150 c/c; the bar bending schedule says 200 c/c. Raised against the superseded revision — still nobody has answered it.", daysAgo: 34 },
    ],
  },
  {
    id: "dmk_sample_6",
    rev: "superseded",
    kind: "cloud",
    geometry: { kind: "cloud", rect: { x: 55.0, y: 12.0, w: 18.0, h: 11.0 }, space: "percent" },
    color: "#F5A524",
    daysAgo: 41,
    resolvedDaysAgo: 30,
    comments: [
      { id: "dmkc_sample_8", body: "Drainage invert levels missing from this corner of the plan.", daysAgo: 41 },
      { id: "dmkc_sample_9", body: "Levels added and issued on the next revision. Closing this one out.", daysAgo: 30 },
    ],
  },
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first();
  if (!project) return;
  if (!(await knex.schema.hasTable("drawing_markups"))) return;
  if (!(await knex.schema.hasTable("document_versions"))) return;

  await seedMarkups(knex, await resolveActor(knex, project));
}

async function seedMarkups(knex: Knex, actorId: string | null): Promise<void> {
  const markupIds = knex("drawing_markups").select("id").where({ project_id: PROJECT_ID });
  if (await knex.schema.hasTable("drawing_markup_comments")) {
    await knex("drawing_markup_comments").whereIn("markup_id", markupIds).del();
  }
  await knex("drawing_markups").where({ project_id: PROJECT_ID }).del();

  const document = await pickDrawingDocument(knex);
  if (!document) return;

  const { current, superseded } = await resolveRevisions(knex, document, actorId);

  for (const markup of MARKUPS) {
    await knex("drawing_markups").insert({
      id: markup.id,
      project_id: PROJECT_ID,
      document_id: document.id,
      document_version_id: markup.rev === "superseded" ? superseded : current,
      page_no: 1,
      precon_session_id: null,
      precon_sheet_id: null,
      precon_row_id: null,
      kind: markup.kind,
      geometry: JSON.stringify(markup.geometry),
      color: markup.color,
      created_by_id: actorId,
      resolved_at: markup.resolvedDaysAgo === undefined ? null : isoDaysAgo(markup.resolvedDaysAgo),
      resolved_by_id: markup.resolvedDaysAgo === undefined ? null : actorId,
      created_at: isoDaysAgo(markup.daysAgo),
      updated_at: isoDaysAgo(markup.resolvedDaysAgo ?? markup.daysAgo),
    });

    if (!(await knex.schema.hasTable("drawing_markup_comments"))) continue;
    await knex("drawing_markup_comments").insert(
      markup.comments.map((comment) => ({
        id: comment.id,
        markup_id: markup.id,
        body: comment.body,
        body_html: `<p>${comment.body}</p>`,
        // Every comment is typed. A voice or video note needs a media file
        // behind it, and one pointing at a key nothing has uploaded plays as
        // a broken clip.
        media_kind: null,
        file_id: null,
        media_duration_seconds: null,
        assignee_id: null,
        created_by_id: actorId,
        created_at: isoDaysAgo(comment.daysAgo),
        updated_at: isoDaysAgo(comment.daysAgo),
      })),
    );
  }
}

/** The sheet the redlines sit on: a plan-discipline document if there is one. */
async function pickDrawingDocument(knex: Knex): Promise<{ id: string; file_name: string } | undefined> {
  const plan = await knex("project_documents as d")
    .join("document_categories as c", "c.id", "d.category_id")
    .where("d.project_id", PROJECT_ID)
    .where("c.group", "plan")
    .orderBy("d.id", "asc")
    .select("d.id", "d.file_name")
    .first();
  if (plan) return plan;
  return knex("project_documents")
    .where({ project_id: PROJECT_ID })
    .orderBy("id", "asc")
    .select("id", "file_name")
    .first();
}

/**
 * The two revisions the redlines hang off.
 *
 * The document seed owns the revision history of the sample drawings and
 * rewrites it on every run, so the revisions are read back rather than
 * assumed: the newest is the live sheet, the one before it is the superseded
 * sheet whose open items must not silently reappear. A drawing that has no
 * history yet (a project seeded without the document pack) gets a minimal two
 * of its own so the revision behaviour is still visible.
 */
async function resolveRevisions(
  knex: Knex,
  document: { id: string; file_name: string },
  actorId: string | null,
): Promise<{ current: string; superseded: string }> {
  const versions = await knex("document_versions")
    .where({ document_id: document.id })
    .orderBy("version_no", "asc")
    .select<{ id: string }[]>("id");

  if (versions.length >= 2) {
    return {
      current: versions[versions.length - 1]!.id,
      superseded: versions[versions.length - 2]!.id,
    };
  }
  if (versions.length === 1) {
    // One revision is the honest history: every redline sits on it.
    return { current: versions[0]!.id, superseded: versions[0]!.id };
  }

  const superseded = await insertVersion(knex, document.id, 1, "Rev A", document.file_name, 47, actorId);
  const current = await insertVersion(
    knex,
    document.id,
    2,
    "Rev B",
    document.file_name.replace(/RevA/i, "RevB"),
    12,
    actorId,
  );
  await knex("project_documents").where({ id: document.id }).update({ current_version_id: current });
  return { current, superseded };
}

async function insertVersion(
  knex: Knex,
  documentId: string,
  versionNo: number,
  revisionLabel: string,
  fileName: string,
  daysAgo: number,
  actorId: string | null,
): Promise<string> {
  const id = `dver_seed_${documentId}_${versionNo}`;
  await knex("document_versions").insert({
    id,
    document_id: documentId,
    file_id: null,
    version_no: versionNo,
    revision_label: revisionLabel,
    file_name: fileName,
    size: "4.2 MB",
    size_bytes: 4_404_019,
    notes: versionNo === 1 ? "Issued for tender. Superseded." : "Setback and window schedule corrected.",
    uploaded_by_id: actorId,
    created_at: isoDaysAgo(daysAgo),
  });
  return id;
}

/**
 * Attribution is a hard FK to an account, so the people the sample data names
 * (the site manager, Engr. David Okonjo) cannot be pointed at here. The first
 * real human in the database stands in; on a database nobody has signed up to
 * there is no one, and the records simply carry no author.
 */
async function resolveActor(knex: Knex, project: { owner_id?: string | null }): Promise<string | null> {
  if (project.owner_id) return project.owner_id;
  const user = await knex("user")
    .where("id", "not like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string } | undefined>("id");
  return user?.id ?? null;
}
