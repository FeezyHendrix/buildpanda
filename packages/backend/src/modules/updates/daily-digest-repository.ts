import type { Knex } from "knex";
import type {
  DigestLoggedActivity,
  DigestOrgAdminRow,
  DigestProjectRow,
  DigestRow,
  DigestSiteNote,
} from "./types.ts";

const PER_SOURCE_LIMIT = 25;

// Every entry is one "what moved today" feed: the table, the column that dates
// the movement, and the column that names the record. Adding a domain to the
// digest is a row here rather than another query.
const MOVEMENT_SOURCES = [
  { key: "rfisRaised", heading: "RFIs raised", table: "rfis", at: "created_at", label: "subject" },
  { key: "rfisAnswered", heading: "RFIs answered", table: "rfis", at: "official_responded_at", label: "subject" },
  { key: "approvalsRaised", heading: "Approvals submitted", table: "approvals", at: "created_at", label: "title" },
  { key: "approvalsDecided", heading: "Approvals decided", table: "approvals", at: "reviewed_at", label: "title" },
  { key: "queriesRaised", heading: "Site queries raised", table: "queries", at: "created_at", label: "subject" },
  { key: "queriesAnswered", heading: "Site queries answered", table: "queries", at: "answered_at", label: "subject" },
  { key: "changesRaised", heading: "Change requests raised", table: "change_requests", at: "created_at", label: "title" },
  { key: "changesDecided", heading: "Change requests decided", table: "change_requests", at: "decided_at", label: "title" },
  { key: "actionsRaised", heading: "Action items raised", table: "action_items", at: "created_at", label: "title" },
  { key: "actionsResolved", heading: "Action items resolved", table: "action_items", at: "resolved_at", label: "title" },
  { key: "activitiesCompleted", heading: "Programme activities completed", table: "activities", at: "actual_end_at", label: "name" },
  // Windowed on created_at, not scheduled_at: the latter is display text
  // ("Oct 21, 2023 • 02:15 PM"), so comparing it to a date matches everything.
  { key: "inspections", heading: "Inspections raised", table: "inspections", at: "created_at", label: "title" },
  { key: "documents", heading: "Documents uploaded", table: "project_documents", at: "created_at", label: "file_name" },
  { key: "selectionsDecided", heading: "Selections decided", table: "project_selections", at: "decided_at", label: "title" },
] as const;

export type MovementKey = (typeof MOVEMENT_SOURCES)[number]["key"];
export type Movements = Record<MovementKey, DigestRow[]>;

export const MOVEMENT_HEADINGS: ReadonlyArray<{ key: MovementKey; heading: string }> =
  MOVEMENT_SOURCES.map((source) => ({ key: source.key, heading: source.heading }));

export function dailyDigestRepository(db: Knex) {
  function inWindow(table: string, at: string, label: string, projectId: string, from: Date, to: Date) {
    return db(table)
      .where({ project_id: projectId })
      .whereNotNull(at)
      .where(at, ">=", from)
      .where(at, "<", to)
      .orderBy(at, "asc")
      .limit(PER_SOURCE_LIMIT)
      .select<DigestRow[]>(`${label} as label`, "status");
  }

  return {
    project(projectId: string) {
      return db("projects")
        .where({ id: projectId })
        .first<{ name: string; progress_percent: number } | undefined>("name", "progress_percent");
    },

    currentStage(projectId: string) {
      return db("project_phases")
        .where({ project_id: projectId, status: "InProgress" })
        .orderBy("sort_order", "asc")
        .first<{ name: string } | undefined>("name");
    },

    siteLog(projectId: string, logDate: string) {
      return db("daily_logs")
        .where({ project_id: projectId, log_date: logDate })
        .whereNull("voided_at")
        .first<
          | {
              weather_condition: string | null;
              temperature_c: string | null;
              workers_expected: number;
              workers_present: number;
              total_hours: string;
            }
          | undefined
        >(
          "weather_condition",
          "temperature_c",
          "workers_expected",
          "workers_present",
          "total_hours",
        );
    },

    // A voided entry is struck from the record, so it never reaches the digest.
    siteNotes(projectId: string, logDate: string): Promise<DigestSiteNote[]> {
      return db("daily_log_entries as e")
        .leftJoin("daily_log_entry_voids as v", "v.entry_id", "e.id")
        .where("e.project_id", projectId)
        .where("e.log_date", logDate)
        .whereNull("v.id")
        .orderBy("e.created_at", "asc")
        .limit(PER_SOURCE_LIMIT)
        .select<DigestSiteNote[]>("e.author_name as author", "e.body_text as body");
    },

    loggedActivities(projectId: string, logDate: string): Promise<DigestLoggedActivity[]> {
      return db("daily_log_activities as la")
        .join("activities as a", "a.id", "la.activity_id")
        .where("la.project_id", projectId)
        .where("la.log_date", logDate)
        .orderBy("a.name", "asc")
        .limit(PER_SOURCE_LIMIT)
        .select<DigestLoggedActivity[]>("a.name", "la.hours_logged as hours");
    },

    materialsLogged(projectId: string, from: Date, to: Date): Promise<DigestRow[]> {
      return db("material_ledger_entries")
        .where({ project_id: projectId })
        .where("occurred_at", ">=", from)
        .where("occurred_at", "<", to)
        .orderBy("occurred_at", "asc")
        .limit(PER_SOURCE_LIMIT)
        .select<DigestRow[]>(
          db.raw(
            "concat(material_name_snapshot, ' — ', quantity, ' ', coalesce(unit_snapshot, '')) as label",
          ),
          "entry_type as status",
        );
    },

    // Tasks have no status column; the board column they sit in is the state.
    tasksCreated(projectId: string, from: Date, to: Date): Promise<DigestRow[]> {
      return db("tasks as t")
        .leftJoin("task_columns as col", "col.id", "t.column_id")
        .where("t.project_id", projectId)
        .where("t.created_at", ">=", from)
        .where("t.created_at", "<", to)
        .orderBy("t.created_at", "asc")
        .limit(PER_SOURCE_LIMIT)
        .select<DigestRow[]>("t.title as label", "col.name as status");
    },

    markupsRaised(projectId: string, from: Date, to: Date): Promise<DigestRow[]> {
      return db("drawing_markups as m")
        .join("project_documents as d", "d.id", "m.document_id")
        .where("m.project_id", projectId)
        .where("m.created_at", ">=", from)
        .where("m.created_at", "<", to)
        .orderBy("m.created_at", "asc")
        .limit(PER_SOURCE_LIMIT)
        .select<DigestRow[]>("d.file_name as label", "m.kind as status");
    },

    markupsResolved(projectId: string, from: Date, to: Date): Promise<DigestRow[]> {
      return db("drawing_markups as m")
        .join("project_documents as d", "d.id", "m.document_id")
        .where("m.project_id", projectId)
        .whereNotNull("m.resolved_at")
        .where("m.resolved_at", ">=", from)
        .where("m.resolved_at", "<", to)
        .orderBy("m.resolved_at", "asc")
        .limit(PER_SOURCE_LIMIT)
        .select<DigestRow[]>("d.file_name as label", "m.kind as status");
    },

    // Recorded money movements only — BuildPanda logs what happened elsewhere.
    financeLogged(projectId: string, from: Date, to: Date): Promise<DigestRow[]> {
      return db("finance_events")
        .where({ project_id: projectId })
        .where("created_at", ">=", from)
        .where("created_at", "<", to)
        .orderBy("created_at", "asc")
        .limit(PER_SOURCE_LIMIT)
        .select<DigestRow[]>("summary as label", "type as status");
    },

    candidateProjects(cadences: readonly string[]): Promise<DigestProjectRow[]> {
      return db<DigestProjectRow>("projects")
        .whereIn("ai_update_cadence", cadences)
        .select("id", "name", "owner_id", "organization_id");
    },

    orgAdmins(organizationIds: string[]): Promise<DigestOrgAdminRow[]> {
      if (organizationIds.length === 0) return Promise.resolve([]);
      return db<DigestOrgAdminRow>("member")
        .whereIn("organizationId", organizationIds)
        .whereIn("role", ["owner", "admin"])
        .select("organizationId", "userId");
    },

    async movements(projectId: string, from: Date, to: Date): Promise<Movements> {
      const results = await Promise.all(
        MOVEMENT_SOURCES.map((source) =>
          inWindow(source.table, source.at, source.label, projectId, from, to),
        ),
      );
      const movements = {} as Movements;
      MOVEMENT_SOURCES.forEach((source, index) => {
        movements[source.key] = results[index] ?? [];
      });
      return movements;
    },
  };
}

export type DailyDigestRepository = ReturnType<typeof dailyDigestRepository>;
