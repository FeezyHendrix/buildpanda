import type { Knex } from "knex";

const PROJECT_ID = "sample-project";

/**
 * Object-store keys only. No .ifc/.xkt binary ships with the repo, so these
 * point at keys nothing has uploaded: the register, the version history and
 * the clash list all read from the DB and render, while the geometry viewer
 * has nothing to fetch (see xkt_status below).
 */
const STORAGE_ROOT = `bim/${PROJECT_ID}`;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** guid, express id, IFC class, the name a modeller typed. */
type ElementSpec = [string, number, string, string];

interface VersionSpec {
  version: number;
  fileName: string;
  sizeBytes: number;
  daysAgo: number;
  elements: ElementSpec[];
}

interface ModelSpec {
  id: string;
  name: string;
  discipline: string;
  versions: VersionSpec[];
}

const MODELS: ModelSpec[] = [
  {
    id: "bim_sample_arch",
    name: "Marbella Villa — Architectural",
    discipline: "Architectural",
    versions: [
      {
        version: 1,
        fileName: "MARB-ARCH-RevA.ifc",
        sizeBytes: 19_340_112,
        daysAgo: 64,
        elements: [
          ["0Kp4mXqR9EwvB2sTnLd1Ua", 1041, "IfcWallStandardCase", "External wall — GF south elevation"],
          ["1Rn8yTcW2AfpQ6hMzKe3Vb", 1042, "IfcWallStandardCase", "Party wall — GF living / dining"],
          ["2Wd5jFbN7LqsX9gPvRt4Mc", 1043, "IfcSlab", "Ground floor slab"],
          ["3Lf9qHsD4ZxnT1bYcJw6Nd", 1044, "IfcDoor", "Main entrance door D-01"],
          ["4Mg2vKzP8RtcY7nQbHu5Pe", 1045, "IfcWindow", "Living room window W-03"],
          ["5Th6bLxV3NqfZ4mWdGs9Qf", 1046, "IfcStair", "Main stair — GF to FF"],
        ],
      },
      {
        version: 2,
        fileName: "MARB-ARCH-RevC.ifc",
        sizeBytes: 22_806_554,
        daysAgo: 9,
        elements: [
          ["0Kp4mXqR9EwvB2sTnLd1Ua", 1041, "IfcWallStandardCase", "External wall — GF south elevation"],
          ["1Rn8yTcW2AfpQ6hMzKe3Vb", 1042, "IfcWallStandardCase", "Party wall — GF living / dining"],
          ["2Wd5jFbN7LqsX9gPvRt4Mc", 1043, "IfcSlab", "Ground floor slab"],
          ["3Lf9qHsD4ZxnT1bYcJw6Nd", 1044, "IfcDoor", "Main entrance door D-01"],
          ["4Mg2vKzP8RtcY7nQbHu5Pe", 1045, "IfcWindow", "Living room window W-03"],
          ["5Th6bLxV3NqfZ4mWdGs9Qf", 1046, "IfcStair", "Main stair — GF to FF"],
          ["6Uj3cNyW5PrgA8kXeMt2Rg", 1047, "IfcSpace", "Study — added by CR-002"],
          ["7Vk7dPzX1QsjB5lYfNu8Sh", 1048, "IfcCovering", "Porcelain floor finish — living / dining"],
        ],
      },
    ],
  },
  {
    id: "bim_sample_struct",
    name: "Marbella Villa — Structural frame",
    discipline: "Structural",
    versions: [
      {
        version: 1,
        fileName: "MARB-STR-RevB.ifc",
        sizeBytes: 14_112_880,
        daysAgo: 21,
        elements: [
          ["8Wm1eQaY6RtkC3nZgPv4Ti", 2071, "IfcColumn", "Column C7 — grid C/3"],
          ["9Xn4fRbZ2SulD7pAhQw5Uj", 2072, "IfcColumn", "Column C8 — grid D/3"],
          ["AYo8gScA7TvmE1qBiRx6Vk", 2073, "IfcBeam", "Beam B12 — first floor grid C-D"],
          ["BZp2hTdB3UwnF6rCjSy7Wl", 2074, "IfcSlab", "First floor slab"],
          ["CAq6jUeC8VxoG2sDkTz8Xm", 2075, "IfcFooting", "Pad footing F-07"],
          ["DBr9kVfD4WypH8tElUa9Yn", 2076, "IfcReinforcingBar", "Column starter bars — 16mm"],
        ],
      },
    ],
  },
  {
    id: "bim_sample_mep",
    name: "Marbella Villa — MEP services",
    discipline: "MEP",
    versions: [
      {
        version: 1,
        fileName: "MARB-MEP-RevA.ifc",
        sizeBytes: 9_884_201,
        daysAgo: 6,
        elements: [
          ["ECs3lWgE9XzqI4uFmVb1Zo", 3011, "IfcDuctSegment", "Supply duct — first floor corridor"],
          ["FDt7mXhF5YarJ9vGnWc2Ap", 3012, "IfcPipeSegment", "Soil stack SS-02"],
          ["GEu1nYiG1ZbsK5wHoXd3Bq", 3013, "IfcPipeSegment", "Cold water riser CW-01"],
          ["HFv5oZjH6ActL1xIpYe4Cr", 3014, "IfcSanitaryTerminal", "WC — first floor guest"],
          ["IGw8pAkI2BduM7yJqZf5Ds", 3015, "IfcLightFixture", "Downlight run — living room"],
        ],
      },
    ],
  },
];

interface IssueSpec {
  id: string;
  modelId: string;
  elementGuid: string;
  position: { x: number; y: number; z: number };
  title: string;
  description: string;
  status: "Open" | "Closed";
  daysAgo: number;
  /** The first clash a PM raises is the one that becomes a formal RFI. */
  linkRfi?: boolean;
}

const ISSUES: IssueSpec[] = [
  {
    id: "bimiss_sample_1",
    modelId: "bim_sample_mep",
    elementGuid: "ECs3lWgE9XzqI4uFmVb1Zo",
    position: { x: 8.42, y: 12.1, z: 3.15 },
    title: "Supply duct clashes with beam B12",
    description:
      "The 400x300 supply duct runs straight through beam B12 at the corridor. Either the duct drops below the beam and the corridor ceiling comes down to 2.4 m, or the beam is penetrated — which the structural engineer has to sign off.",
    status: "Open",
    daysAgo: 5,
    linkRfi: true,
  },
  {
    id: "bimiss_sample_2",
    modelId: "bim_sample_mep",
    elementGuid: "FDt7mXhF5YarJ9vGnWc2Ap",
    position: { x: 3.05, y: 6.8, z: 2.4 },
    title: "Soil stack SS-02 passes through the kitchen window opening",
    description:
      "Stack is set out on the external wall where the kitchen window W-07 sits on Rev C. Stack to move 600 mm east into the utility duct.",
    status: "Closed",
    daysAgo: 17,
  },
  {
    id: "bimiss_sample_3",
    modelId: "bim_sample_struct",
    elementGuid: "0Kp4mXqR9EwvB2sTnLd1Ua",
    position: { x: 14.2, y: 2.35, z: 0.0 },
    title: "Column C7 sits 150 mm off the architectural grid",
    description:
      "Structural Rev B places C7 at 150 mm east of grid C/3. On site the column is already cast — the architectural model, not the column, needs to move.",
    status: "Open",
    daysAgo: 11,
  },
  {
    id: "bimiss_sample_4",
    modelId: "bim_sample_arch",
    elementGuid: "5Th6bLxV3NqfZ4mWdGs9Qf",
    position: { x: 10.9, y: 9.4, z: 1.8 },
    title: "Stair headroom 1.94 m at the half landing",
    description:
      "Headroom under the first-floor slab at the half landing falls below the 2.0 m minimum. Landing needs to move two risers, or the slab edge is trimmed.",
    status: "Open",
    daysAgo: 3,
  },
  {
    id: "bimiss_sample_5",
    modelId: "bim_sample_arch",
    elementGuid: "3Lf9qHsD4ZxnT1bYcJw6Nd",
    position: { x: 0.6, y: 4.2, z: 2.1 },
    title: "No lintel modelled over the garage opening",
    description: "Garage opening is 3.6 m wide with no lintel in the model. Structural confirmed a 225x300 RC lintel on Rev B.",
    status: "Closed",
    daysAgo: 28,
  },
];

/** Element → the record it is priced, programmed or varied against. */
const LINKS: { id: string; modelId: string; guid: string; type: string; table: string; targetId: string }[] = [
  { id: "bimlink_sample_1", modelId: "bim_sample_struct", guid: "CAq6jUeC8VxoG2sDkTz8Xm", type: "phase", table: "project_phases", targetId: "p1" },
  { id: "bimlink_sample_2", modelId: "bim_sample_struct", guid: "8Wm1eQaY6RtkC3nZgPv4Ti", type: "phase", table: "project_phases", targetId: "p2" },
  { id: "bimlink_sample_3", modelId: "bim_sample_mep", guid: "ECs3lWgE9XzqI4uFmVb1Zo", type: "phase", table: "project_phases", targetId: "p3" },
  { id: "bimlink_sample_4", modelId: "bim_sample_arch", guid: "7Vk7dPzX1QsjB5lYfNu8Sh", type: "change_request", table: "change_requests", targetId: "chg1" },
  { id: "bimlink_sample_5", modelId: "bim_sample_struct", guid: "DBr9kVfD4WypH8tElUa9Yn", type: "cost_item", table: "material_procurements", targetId: "mp1" },
  { id: "bimlink_sample_6", modelId: "bim_sample_struct", guid: "AYo8gScA7TvmE1qBiRx6Vk", type: "activity", table: "activities", targetId: "act-1" },
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first();
  if (!project) return;
  if (!(await knex.schema.hasTable("bim_models"))) return;

  const actorId = await resolveActor(knex, project);

  // Versions, elements, issues and links all cascade from the model row.
  await knex("bim_models").where({ project_id: PROJECT_ID }).del();

  for (const model of MODELS) {
    await knex("bim_models").insert({
      id: model.id,
      project_id: PROJECT_ID,
      name: model.name,
      discipline: model.discipline,
      current_version_id: null,
      created_by_id: actorId,
      created_at: isoDaysAgo(model.versions[0]!.daysAgo),
      updated_at: isoDaysAgo(model.versions[model.versions.length - 1]!.daysAgo),
    });

    let latestVersionId = "";
    for (const version of model.versions) {
      const versionId = `${model.id}_v${version.version}`;
      await knex("bim_model_versions").insert({
        id: versionId,
        bim_model_id: model.id,
        version: version.version,
        source_storage_path: `${STORAGE_ROOT}/${model.id}/v${version.version}/${version.fileName}`,
        source_file_name: version.fileName,
        // A finished state, so the register lists the model instead of
        // spinning on a conversion job that will never be enqueued.
        status: "Ready",
        failure_reason: null,
        size_bytes: version.sizeBytes,
        // Matches the rows in bim_elements: a count the element pickers
        // cannot honour would read as data loss.
        element_count: version.elements.length,
        xkt_storage_path: null,
        // "Skipped" is the other terminal state: the xkt endpoint answers
        // with a null url rather than signing a key that holds no object.
        xkt_status: "Skipped",
        created_by_id: actorId,
        created_at: isoDaysAgo(version.daysAgo),
      });
      latestVersionId = versionId;

      if (await knex.schema.hasTable("bim_elements")) {
        await knex("bim_elements").insert(
          version.elements.map(([guid, expressId, ifcType, name], index) => ({
            id: `${versionId}_e${index + 1}`,
            model_version_id: versionId,
            guid,
            express_id: expressId,
            ifc_type: ifcType,
            name,
          })),
        );
      }
    }
    await knex("bim_models").where({ id: model.id }).update({ current_version_id: latestVersionId });
  }

  if (await knex.schema.hasTable("bim_coordination_issues")) {
    // RFIs are re-seeded with fresh uuids on every run, so the clash that
    // became a formal RFI has to find its number at seed time.
    const rfi = await knex("rfis").where({ project_id: PROJECT_ID }).orderBy("created_at", "asc").first();
    await knex("bim_coordination_issues").insert(
      ISSUES.map((issue) => ({
        id: issue.id,
        bim_model_id: issue.modelId,
        element_guid: issue.elementGuid,
        position: JSON.stringify(issue.position),
        title: issue.title,
        description: issue.description,
        description_html: `<p>${issue.description}</p>`,
        status: issue.status,
        rfi_id: issue.linkRfi && rfi ? rfi.id : null,
        assignee_id: actorId,
        created_by_id: actorId,
        created_at: isoDaysAgo(issue.daysAgo),
        updated_at: isoDaysAgo(issue.status === "Closed" ? Math.max(issue.daysAgo - 6, 0) : issue.daysAgo),
      })),
    );
  }

  if (await knex.schema.hasTable("bim_element_links")) {
    const present: typeof LINKS = [];
    for (const link of LINKS) {
      if (!(await knex.schema.hasTable(link.table))) continue;
      const target = await knex(link.table).where({ id: link.targetId }).first();
      if (target) present.push(link);
    }
    if (present.length > 0) {
      await knex("bim_element_links").insert(
        present.map((link) => ({
          id: link.id,
          bim_model_id: link.modelId,
          element_guid: link.guid,
          link_type: link.type,
          target_id: link.targetId,
          target_table: link.table,
          created_at: isoDaysAgo(12),
        })),
      );
    }
  }
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
