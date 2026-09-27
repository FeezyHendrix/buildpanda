import type { Knex } from "knex";

/**
 * Finding a named piece of work across the records that describe work.
 *
 * "What changed on culvert 1" is not a drawing-markup question: the answer sits
 * in the activities, the delays logged against them, the RFIs, the change
 * requests, the risks, the inspections and the material orders that mention it.
 * One sweep reads all seven so the assistant cannot answer from a single empty
 * domain (finding F60). Split out of repository.ts, which is already at size.
 */

/** One record whose text names the piece of work the user asked about. */
export interface WorkRecordHit {
  kind: "activity" | "delay" | "rfi" | "change_request" | "risk" | "inspection" | "material_order";
  id: string;
  title: string;
  status: string | null;
  detail: string | null;
  [column: string]: unknown;
}

export function workRecordsRepository(db: Knex) {
  return {
    /**
     * The per-domain reads behind workRecords, exposed so the SQL can be
     * asserted without a database.
     */
    workRecordQueries(projectId: string, terms: string[]) {
      const matchAll = (builder: Knex.QueryBuilder, columns: string[]): Knex.QueryBuilder => {
        const haystack = columns.map((c) => `COALESCE(${c}, '')`).join(" || ' ' || ");
        for (const term of terms) builder.whereRaw(`(${haystack}) ILIKE ?`, [`%${term}%`]);
        return builder;
      };

      return [
        {
          kind: "activity" as const,
          query: matchAll(
            db("activities")
              .where({ project_id: projectId })
              .limit(25)
              .select(
                "id",
                "name as title",
                "status",
                "location",
                "notes as detail",
                "planned_start_at as startsAt",
                "planned_end_at as endsAt",
                "percent_complete as percentComplete",
              ),
            ["name", "location", "notes", "wbs_code"],
          ),
        },
        {
          kind: "delay" as const,
          query: matchAll(
            db("activity_delays as d")
              .join("activities as a", "a.id", "d.activity_id")
              .where("a.project_id", projectId)
              .limit(25)
              .select(
                "d.id",
                "a.name as title",
                "d.reason_code as status",
                "d.description as detail",
                "d.days_lost as daysLost",
                "d.culpability",
                "d.eot_claimable as eotClaimable",
                "d.started_at as startsAt",
                "d.ended_at as endsAt",
              ),
            ["a.name", "d.description", "d.reason_code"],
          ),
        },
        {
          kind: "rfi" as const,
          query: matchAll(
            db("rfis")
              .where({ project_id: projectId })
              .limit(25)
              .select(
                "id",
                "subject as title",
                "status",
                "question as detail",
                "due_date as endsAt",
                "official_response as response",
              ),
            ["subject", "question", "official_response"],
          ),
        },
        {
          kind: "change_request" as const,
          query: matchAll(
            db("change_requests")
              .where({ project_id: projectId })
              .limit(25)
              .select(
                "id",
                "title",
                "status",
                "description as detail",
                "reason",
                "cost_impact as costImpact",
                "time_impact_days as timeImpactDays",
                "decided_at as endsAt",
              ),
            ["title", "description", "reason"],
          ),
        },
        {
          kind: "risk" as const,
          query: matchAll(
            db("risk_factors")
              .where({ project_id: projectId })
              .limit(25)
              .select("id", "title", "status", "description as detail", "severity", "mitigation"),
            ["title", "description", "mitigation"],
          ),
        },
        {
          kind: "inspection" as const,
          query: matchAll(
            db("inspections")
              .where({ project_id: projectId })
              .limit(25)
              .select(
                "id",
                "title",
                "service_status as status",
                "description as detail",
                "outcome",
                "findings",
                "scheduled_at as startsAt",
              ),
            ["title", "description", "findings", "location"],
          ),
        },
        {
          kind: "material_order" as const,
          query: matchAll(
            db("material_orders")
              .where({ project_id: projectId })
              .limit(25)
              .select(
                "id",
                "material_name as title",
                "status",
                "notes as detail",
                "quantity",
                "unit",
                "supplier",
                "needed_by as endsAt",
              ),
            ["material_name", "title", "notes", "supplier"],
          ),
        },
      ];
    },

    /**
     * Everything on the project whose text names a piece of work — "culvert 1",
     * "ch 0+420", "the box culvert". A PM asking "what changed on X" means the
     * records that describe work, so one sweep covers activities and their
     * delays, RFIs, change requests, risks, inspections and material orders
     * rather than leaving the model to guess a single domain tool.
     */
    async workRecords(
      projectId: string,
      terms: string[],
      kinds?: ReadonlyArray<WorkRecordHit["kind"]>,
    ): Promise<WorkRecordHit[]> {
      if (terms.length === 0) return [];
      const allowed = kinds ? new Set<string>(kinds) : null;
      const reads = workRecordsRepository(db)
        .workRecordQueries(projectId, terms)
        .filter((read) => allowed === null || allowed.has(read.kind));
      if (reads.length === 0) return [];
      const results = await Promise.all(reads.map((r) => r.query));
      return reads.flatMap((read, index) =>
        (results[index] as Record<string, unknown>[]).map(
          (row) => ({ kind: read.kind, ...row }) as WorkRecordHit,
        ),
      );
    },
  };
}

export type WorkRecordsRepository = ReturnType<typeof workRecordsRepository>;
