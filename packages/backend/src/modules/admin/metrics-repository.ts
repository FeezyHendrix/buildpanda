import type { Knex } from "knex";

const TZ = "Africa/Lagos";

const PRICE_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT input_per_1k, output_per_1k
    FROM llm_prices
    WHERE model_version = c.model_version
      AND effective_from <= c.created_at
      AND (effective_to IS NULL OR c.created_at < effective_to)
    ORDER BY effective_from DESC
    LIMIT 1
  ) p ON true`;

export interface MetricRange {
  from: Date;
  to: Date;
}

export function priorRange(range: MetricRange): MetricRange {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: range.from };
}

export function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function funnelConversions(
  steps: Array<{ step: string; value: number }>,
): Array<{ step: string; value: number; conversionPct: number }> {
  return steps.map((s, i) => {
    if (i === 0) return { ...s, conversionPct: 100 };
    const prev = steps[i - 1]!.value;
    return { ...s, conversionPct: prev > 0 ? (s.value / prev) * 100 : 0 };
  });
}

interface DailyPoint {
  day: string;
  value: number;
}

function num(v: { count?: string; total?: string } | undefined, key: "count" | "total" = "count"): number {
  return Number(v?.[key] ?? 0);
}

function bucketDay(db: Knex, column: string): Knex.Raw {
  return db.raw(`date_trunc('day', ?? AT TIME ZONE ?)::date AS day`, [column, TZ]);
}

export function adminMetricsRepository(db: Knex) {
  async function signupSeries(range: MetricRange): Promise<DailyPoint[]> {
    const rows = await db("user")
      .select(bucketDay(db, "createdAt"))
      .count<{ day: string; count: string }[]>("id as count")
      .whereBetween("createdAt", [range.from, range.to])
      .groupByRaw("1")
      .orderByRaw("1");
    return rows.map((r) => ({ day: String(r.day), value: Number(r.count) }));
  }

  async function activeUserSeries(range: MetricRange): Promise<DailyPoint[]> {
    const rows = await db("user")
      .select(bucketDay(db, "last_activity_at"))
      .count<{ day: string; count: string }[]>("id as count")
      .whereBetween("last_activity_at", [range.from, range.to])
      .groupByRaw("1")
      .orderByRaw("1");
    return rows.map((r) => ({ day: String(r.day), value: Number(r.count) }));
  }

  async function totalSignups(range: MetricRange): Promise<number> {
    const row = await db("user")
      .whereBetween("createdAt", [range.from, range.to])
      .count<{ count: string }[]>("id as count")
      .first();
    return num(row);
  }

  async function activeUsers(windowFrom: Date, to: Date): Promise<number> {
    const row = await db("user")
      .whereBetween("last_activity_at", [windowFrom, to])
      .count<{ count: string }[]>("id as count")
      .first();
    return num(row);
  }

  async function activationFunnel(range: MetricRange) {
    const cohort = db("user")
      .whereBetween("createdAt", [range.from, range.to])
      .select("id");

    const [signed, withOrg, withProposal, withTakeoff] = await Promise.all([
      db("user").whereBetween("createdAt", [range.from, range.to]).count<{ count: string }[]>("id as count").first(),
      db("member")
        .whereIn("userId", cohort.clone())
        .countDistinct<{ count: string }[]>("userId as count")
        .first(),
      db("proposals as p")
        .whereIn("p.created_by", cohort.clone())
        .andWhere("p.created_at", ">=", range.from)
        .countDistinct<{ count: string }[]>("p.created_by as count")
        .first(),
      db("takeoff_jobs as t")
        .whereIn("t.requested_by", cohort.clone())
        .andWhere("t.created_at", ">=", range.from)
        .countDistinct<{ count: string }[]>("t.requested_by as count")
        .first(),
    ]);

    return [
      { step: "Signed up", value: num(signed) },
      { step: "Joined org", value: num(withOrg) },
      { step: "Created proposal", value: num(withProposal) },
      { step: "Ran take-off", value: num(withTakeoff) },
    ];
  }

  async function aiTokenSeries(range: MetricRange): Promise<Array<{ day: string; tokensIn: number; tokensOut: number; costUsd: number }>> {
    const rows = await db("llm_calls as c")
      .joinRaw(PRICE_LATERAL)
      .select(bucketDay(db, "c.created_at"))
      .whereBetween("c.created_at", [range.from, range.to])
      .groupByRaw("1")
      .orderByRaw("1")
      .select(
        db.raw("COALESCE(SUM(c.tokens_in), 0)::bigint AS tokens_in"),
        db.raw("COALESCE(SUM(c.tokens_out), 0)::bigint AS tokens_out"),
        db.raw(
          "COALESCE(SUM(COALESCE(c.tokens_in,0) * p.input_per_1k / 1000.0 + COALESCE(c.tokens_out,0) * p.output_per_1k / 1000.0), 0)::numeric AS cost_usd",
        ),
      );
    return rows.map((r: Record<string, unknown>) => ({
      day: String(r["day"]),
      tokensIn: Number(r["tokens_in"] ?? 0),
      tokensOut: Number(r["tokens_out"] ?? 0),
      costUsd: Number(r["cost_usd"] ?? 0),
    }));
  }

  async function aiCostByOrg(range: MetricRange, limit = 10) {
    const rows = await db("llm_calls as c")
      .joinRaw(PRICE_LATERAL)
      .leftJoin("organization as o", "o.id", "c.org_id")
      .whereBetween("c.created_at", [range.from, range.to])
      .whereNotNull("c.org_id")
      .groupBy("c.org_id", "o.name")
      .select(
        "c.org_id as orgId",
        "o.name as orgName",
        db.raw("COALESCE(SUM(c.tokens_in),0)::bigint AS tokens_in"),
        db.raw("COALESCE(SUM(c.tokens_out),0)::bigint AS tokens_out"),
        db.raw(
          "COALESCE(SUM(COALESCE(c.tokens_in,0) * p.input_per_1k / 1000.0 + COALESCE(c.tokens_out,0) * p.output_per_1k / 1000.0),0)::numeric AS cost_usd",
        ),
      )
      .orderBy("cost_usd", "desc")
      .limit(limit);
    return rows.map((r: Record<string, unknown>) => ({
      orgId: r["orgId"] as string,
      orgName: (r["orgName"] as string | null) ?? "Unknown",
      tokensIn: Number(r["tokens_in"] ?? 0),
      tokensOut: Number(r["tokens_out"] ?? 0),
      costUsd: Number(r["cost_usd"] ?? 0),
    }));
  }

  async function uncostedTokens(range: MetricRange): Promise<{ tokens: number; models: string[] }> {
    const rows = await db("llm_calls as c")
      .joinRaw(PRICE_LATERAL)
      .whereBetween("c.created_at", [range.from, range.to])
      .whereNull("p.input_per_1k")
      .whereNotNull("c.model_version")
      .groupBy("c.model_version")
      .select(
        "c.model_version as model",
        db.raw("COALESCE(SUM(COALESCE(c.tokens_in,0) + COALESCE(c.tokens_out,0)),0)::bigint AS tokens"),
      );
    return {
      tokens: rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r["tokens"] ?? 0), 0),
      models: rows.map((r: Record<string, unknown>) => String(r["model"])),
    };
  }

  async function aiJobHealth(range: MetricRange) {
    const table = (name: string) =>
      db(name)
        .whereBetween("created_at", [range.from, range.to])
        .select(
          db.raw("? AS job_type", [name]),
          db.raw("COUNT(*)::int AS total"),
          db.raw("COUNT(*) FILTER (WHERE status = 'completed')::int AS completed"),
          db.raw("COUNT(*) FILTER (WHERE status = 'failed')::int AS failed"),
          db.raw(
            "COUNT(*) FILTER (WHERE status = 'processing' AND started_at < now() - interval '1 hour')::int AS stuck",
          ),
          db.raw(
            "COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL), 0)::numeric AS avg_latency_s",
          ),
        )
        .first();

    const [takeoff, programme, boq] = await Promise.all([
      table("takeoff_jobs"),
      table("programme_import_jobs"),
      table("boq_import_jobs"),
    ]);

    return [takeoff, programme, boq]
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((r) => ({
        jobType: String(r["job_type"]),
        total: Number(r["total"] ?? 0),
        completed: Number(r["completed"] ?? 0),
        failed: Number(r["failed"] ?? 0),
        stuck: Number(r["stuck"] ?? 0),
        avgLatencySeconds: Number(r["avg_latency_s"] ?? 0),
      }));
  }

  async function valueTracked() {
    const [totals, highest] = await Promise.all([
      db("project_finances")
        .sum<{ total: string }[]>({ total: "total_budget" })
        .first(),
      db("project_finances as f")
        .join("projects as p", "p.id", "f.project_id")
        .select("p.id", "p.name", "f.total_budget as totalBudget", "p.currency")
        .orderBy("f.total_budget", "desc")
        .first(),
    ]);
    return {
      totalBudgetTracked: Number(totals?.total ?? 0),
      highestBudgetedProject: highest ?? null,
    };
  }

  return {
    signupSeries,
    activeUserSeries,
    totalSignups,
    activeUsers,
    activationFunnel,
    aiTokenSeries,
    aiCostByOrg,
    aiJobHealth,
    uncostedTokens,
    valueTracked,
  };
}

export type AdminMetricsRepository = ReturnType<typeof adminMetricsRepository>;
