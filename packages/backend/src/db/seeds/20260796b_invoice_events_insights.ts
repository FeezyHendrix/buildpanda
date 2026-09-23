import type { Knex } from "knex";

/**
 * The reading side of the demo project: the audit trail behind each invoice
 * and the Panda AI analyses a PM would have run (the weather assessment is in
 * the sibling 20260796c file, to keep each one under the size ceiling).
 *
 * Everything here is derived from rows the earlier seeds already inserted —
 * the figures are read back out of the database rather than written twice, so
 * the demo can never quote a number the rest of the fixture contradicts.
 */
const PROJECT_ID = "sample-project";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function plusDays(base: string | Date, days: number): Date {
  return new Date(new Date(base).getTime() + days * 24 * 60 * 60 * 1000);
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-US")}`;
}

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  issue_date: string | Date | null;
  due_date: string | Date | null;
  total_invoiced: string | null;
  created_at: string | Date;
}

interface PaymentRow {
  invoice_id: string;
  amount: string;
  paid_at: string | Date | null;
  created_at: string | Date;
}

// The one certificate the client formally disputed. A query always carries a
// reason — "Queried" on its own is not a record a QS can answer.
const QUERIED_INVOICE = "SUB-INV-2026-016";
const QUERY_REASON =
  "Fittings line is billed as a lump sum; the client asked for the assorted PVC fittings to be itemised before approval.";

async function seedInvoiceEvents(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("invoice_events"))) return;
  await knex("invoice_events").where({ project_id: PROJECT_ID }).del();

  const invoices = await knex<InvoiceRow>("project_invoices")
    .where({ project_id: PROJECT_ID })
    .select("id", "number", "status", "issue_date", "due_date", "total_invoiced", "created_at")
    .orderBy("issue_date", "asc");
  if (invoices.length === 0) return;

  const payments = await knex<PaymentRow>("invoice_payments")
    .whereIn("invoice_id", invoices.map((invoice) => invoice.id))
    .select("invoice_id", "amount", "paid_at", "created_at");

  const rows: Record<string, unknown>[] = [];
  let seq = 0;
  const push = (
    invoice: InvoiceRow,
    type: string,
    at: Date,
    fields: { from?: string | null; to?: string | null; reason?: string | null; actor: string; amount?: number | null },
  ): void => {
    rows.push({
      id: `invev-seed-${++seq}`,
      invoice_id: invoice.id,
      project_id: PROJECT_ID,
      type,
      from_status: fields.from ?? null,
      to_status: fields.to ?? null,
      reason: fields.reason ?? null,
      // No seeded user rows to attribute to, so the trail carries the name the
      // person is known by everywhere else in the fixture.
      actor_id: null,
      actor_name: fields.actor,
      amount: fields.amount === undefined || fields.amount === null ? null : fields.amount.toFixed(2),
      created_at: at,
    });
  };

  for (const invoice of invoices) {
    const issued = invoice.issue_date ?? invoice.created_at;
    push(invoice, "created", new Date(issued), { to: "Draft", actor: "Engr. David Okonjo" });
    if (invoice.status === "Draft") continue;

    push(invoice, "sent", plusDays(issued, 1), { from: "Draft", to: "Sent", actor: "Arinze Obi" });

    if (invoice.number === QUERIED_INVOICE) {
      push(invoice, "queried", plusDays(issued, 4), {
        from: "Sent",
        to: "Queried",
        reason: QUERY_REASON,
        actor: "Adeyi Client",
      });
      // Re-issued once the line was itemised, which is why the row still reads
      // as Submitted rather than Queried.
      push(invoice, "sent", plusDays(issued, 6), { from: "Queried", to: "Sent", actor: "Arinze Obi" });
    }

    if (invoice.status === "Approved") {
      push(invoice, "approved", plusDays(issued, 3), { from: "Sent", to: "Approved", actor: "Dr. Angela Bello" });
    }

    for (const payment of payments.filter((row) => row.invoice_id === invoice.id)) {
      push(invoice, "payment_recorded", new Date(payment.paid_at ?? payment.created_at), {
        actor: "Adeyi Client",
        amount: num(payment.amount),
      });
    }
  }

  if (rows.length > 0) await knex("invoice_events").insert(rows);
}

interface SeedMetrics {
  projectName: string;
  status: string;
  currency: string;
  progressPercent: number;
  phaseCount: number;
  pendingPhaseCount: number;
  budgetPlanned: number;
  budgetCommitted: number;
  budgetActual: number;
  budgetVariance: number;
  overBudgetCategories: number;
  invoiceCount: number;
  invoicedTotal: number;
  paidTotal: number;
  outstandingInvoiced: number;
  overdueInvoiceCount: number;
  openRiskCount: number;
  highRiskCount: number;
  inspectionCount: number;
  failedInspectionCount: number;
  pendingInspectionCount: number;
  recentUpdateCount: number;
  daysSinceLastUpdate: number | null;
  recentDailyLogCount: number;
  missedKeyDateCount: number;
  overdueActivityCount: number;
  pendingApprovalCount: number;
  expiringPermitCount: number;
  pendingChangeRequestCostImpact: number;
}

/** Reads the same signals the live analyzer reads, straight off the fixture. */
async function buildMetrics(knex: Knex): Promise<SeedMetrics | null> {
  const project = await knex("projects")
    .where({ id: PROJECT_ID })
    .first<{ name: string; status: string; currency: string; progress_percent: number }>(
      "name",
      "status",
      "currency",
      "progress_percent",
    );
  if (!project) return null;

  const recentCutoff = daysAgo(14).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const inThirtyDays = daysAgo(-30).toISOString().slice(0, 10);
  const scope = (table: string) => knex(table).where({ project_id: PROJECT_ID });
  const count = async (query: Knex.QueryBuilder): Promise<number> =>
    num((await query.count<{ count: string }>("* as count").first())?.count);

  const [phases, categories, invoices, payments, risks, inspections] = await Promise.all([
    scope("project_phases").select<{ status: string }[]>("status"),
    scope("project_budget_categories").select<{ planned: string; committed: string; actual: string }[]>(
      "planned",
      "committed",
      "actual",
    ),
    scope("project_invoices").select<{ id: string; status: string; due_date: string | null; total_invoiced: string | null }[]>(
      "id",
      "status",
      "due_date",
      "total_invoiced",
    ),
    knex("invoice_payments")
      .join("project_invoices", "invoice_payments.invoice_id", "project_invoices.id")
      .where("project_invoices.project_id", PROJECT_ID)
      .select<{ invoice_id: string; amount: string }[]>("invoice_payments.invoice_id", "invoice_payments.amount"),
    scope("risk_factors").select<{ severity: string }[]>("severity"),
    scope("inspections").select<{ status: string }[]>("status"),
  ]);

  const [recentUpdates, latestUpdate, recentLogs, missedKeyDates, overdueActivities, pendingApprovals, expiringPermits, changeImpact] =
    await Promise.all([
      count(scope("project_updates").where("created_at", ">=", recentCutoff)),
      scope("project_updates").max<{ last: string | Date | null }>("created_at as last").first(),
      count(scope("daily_logs").where("created_at", ">=", recentCutoff)),
      count(scope("key_dates").where({ status: "Missed" })),
      count(scope("activities").whereNotIn("status", ["Completed", "Cancelled"]).where("planned_end_at", "<", new Date())),
      count(scope("approvals").where({ status: "Pending" })),
      count(scope("permits").whereNotNull("expiry_date").where("expiry_date", "<=", inThirtyDays)),
      scope("change_requests").where({ status: "Submitted" }).sum<{ sum: string | null }>("cost_impact as sum").first(),
    ]);

  const paidByInvoice = new Map<string, number>();
  for (const payment of payments) {
    paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + num(payment.amount));
  }
  const invoicedTotal = invoices.reduce((sum, invoice) => sum + num(invoice.total_invoiced), 0);
  const paidTotal = [...paidByInvoice.values()].reduce((sum, amount) => sum + amount, 0);
  // Overdue is computed from the dates and the money recorded against the row,
  // never from a stored status — a paid invoice past its date is not overdue.
  const overdueInvoiceCount = invoices.filter(
    (invoice) =>
      invoice.due_date !== null &&
      String(invoice.due_date).slice(0, 10) < today &&
      (paidByInvoice.get(invoice.id) ?? 0) < num(invoice.total_invoiced),
  ).length;

  const budgetPlanned = categories.reduce((sum, row) => sum + num(row.planned), 0);
  const budgetActual = categories.reduce((sum, row) => sum + num(row.actual), 0);
  const lastUpdateAt = latestUpdate?.last ? new Date(latestUpdate.last) : null;

  return {
    projectName: project.name,
    status: project.status,
    currency: project.currency,
    progressPercent: num(project.progress_percent),
    phaseCount: phases.length,
    pendingPhaseCount: phases.filter((phase) => phase.status !== "Done").length,
    budgetPlanned,
    budgetCommitted: categories.reduce((sum, row) => sum + num(row.committed), 0),
    budgetActual,
    budgetVariance: budgetActual - budgetPlanned,
    overBudgetCategories: categories.filter((row) => num(row.actual) > num(row.planned)).length,
    invoiceCount: invoices.length,
    invoicedTotal,
    paidTotal,
    outstandingInvoiced: invoicedTotal - paidTotal,
    overdueInvoiceCount,
    openRiskCount: risks.length,
    highRiskCount: risks.filter((risk) => risk.severity === "High").length,
    inspectionCount: inspections.length,
    failedInspectionCount: inspections.filter((row) => row.status === "Action Required").length,
    pendingInspectionCount: inspections.filter((row) => row.status === "Scheduled").length,
    recentUpdateCount: recentUpdates,
    daysSinceLastUpdate: lastUpdateAt
      ? Math.max(0, Math.round((Date.now() - lastUpdateAt.getTime()) / 86_400_000))
      : null,
    recentDailyLogCount: recentLogs,
    missedKeyDateCount: missedKeyDates,
    overdueActivityCount: overdueActivities,
    pendingApprovalCount: pendingApprovals,
    expiringPermitCount: expiringPermits,
    pendingChangeRequestCostImpact: num(changeImpact?.sum),
  };
}

async function seedInsights(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("project_ai_insights"))) return;
  await knex("project_ai_insights").where({ project_id: PROJECT_ID }).del();

  const metrics = await buildMetrics(knex);
  if (!metrics) return;

  const openRfis = num(
    (
      await knex("rfis")
        .where({ project_id: PROJECT_ID })
        .whereIn("status", ["Open", "InReview"])
        .count<{ count: string }>("* as count")
        .first()
    )?.count,
  );

  const suggestions: { title: string; detail: string; priority: string; category: string }[] = [];
  if (metrics.outstandingInvoiced > 0) {
    suggestions.push({
      title: metrics.overdueInvoiceCount > 0
        ? `${metrics.overdueInvoiceCount} invoice${metrics.overdueInvoiceCount === 1 ? " is" : "s are"} past the due date`
        : "Outstanding invoiced amount to monitor",
      detail: `${naira(metrics.outstandingInvoiced)} has been invoiced against this project and not yet recorded as paid. Schedule the payments against the cash-flow plan before any of it ages further.`,
      priority: metrics.overdueInvoiceCount > 0 ? "high" : "medium",
      category: "Finance",
    });
  }
  if (metrics.pendingChangeRequestCostImpact > 0) {
    suggestions.push({
      title: "A change request is still awaiting a decision",
      detail: `${naira(metrics.pendingChangeRequestCostImpact)} of submitted change is undecided. Until it is approved or rejected it sits outside the contract sum, and the work it covers cannot be programmed.`,
      priority: "high",
      category: "Commercial",
    });
  }
  if (openRfis > 0) {
    suggestions.push({
      title: `${openRfis} RFI${openRfis === 1 ? " is" : "s are"} still open`,
      detail: "Open RFIs on the first-floor works hold the trades that depend on the answer. Chase the ball-in-court party and record the response against the RFI so the answer is contractually traceable.",
      priority: "medium",
      category: "Design",
    });
  }
  if (metrics.highRiskCount > 0) {
    suggestions.push({
      title: `${metrics.highRiskCount} high-severity risk${metrics.highRiskCount === 1 ? "" : "s"} on the register`,
      detail: `The register carries ${metrics.openRiskCount} live risk${metrics.openRiskCount === 1 ? "" : "s"}, including the rainy season against the roofing programme. Each one needs a named owner and a mitigation date, not just an entry.`,
      priority: "medium",
      category: "Risk",
    });
  }
  if (metrics.pendingApprovalCount > 0) {
    suggestions.push({
      title: `${metrics.pendingApprovalCount} approval${metrics.pendingApprovalCount === 1 ? " is" : "s are"} waiting on the client`,
      detail: "Selections and specification approvals still with the owner will start to drive procurement lead times. Set a decision-by date on each and record it.",
      priority: "low",
      category: "Client",
    });
  }

  // The stored score follows the same shape the live analyzer uses: start at
  // 100 and deduct against the signals that actually appear in the data.
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.min(metrics.overdueInvoiceCount * 4, 20) -
          Math.min(metrics.highRiskCount * 5, 15) -
          Math.min(metrics.overBudgetCategories * 3, 12) -
          Math.min(metrics.failedInspectionCount * 4, 12),
      ),
    ),
  );
  const headline = score >= 80 ? "is in good shape" : score >= 60 ? "needs attention in a few areas" : "has several issues that need immediate attention";
  const summary = `${metrics.projectName} ${headline}. Progress is at ${metrics.progressPercent}% with ${metrics.pendingPhaseCount} of ${metrics.phaseCount} phases still pending, and ${naira(metrics.outstandingInvoiced)} invoiced but not yet recorded as paid.${suggestions[0] ? ` Top focus: ${suggestions[0].title.toLowerCase()}.` : ""}`;

  // Prior analyses are kept so the reporting page has a health trend to draw;
  // each is the score that run recorded, not a restatement of today's figures.
  const history = [
    { days: 21, score: Math.max(0, score - 6), summary: `${metrics.projectName} was tracking behind on the first-floor formwork, with the column rebar query unanswered and the roofing accessories still unordered.` },
    { days: 10, score: Math.max(0, score - 3), summary: `${metrics.projectName} closed out the column rebar query and restarted shuttering; the change request and the client selections were the remaining holds.` },
  ];

  await knex("project_ai_insights").insert([
    ...history.map((entry, index) => ({
      id: `pai-seed-${index + 1}`,
      project_id: PROJECT_ID,
      status: "complete",
      summary: entry.summary,
      suggestions: JSON.stringify([]),
      metrics: null,
      health_score: entry.score,
      model: "panda-rules-v1",
      error: null,
      requested_by: "seed-pm",
      created_at: daysAgo(entry.days),
      updated_at: daysAgo(entry.days),
    })),
    {
      id: `pai-seed-${history.length + 1}`,
      project_id: PROJECT_ID,
      status: "complete",
      summary,
      suggestions: JSON.stringify(suggestions),
      metrics: JSON.stringify(metrics),
      health_score: score,
      model: "panda-rules-v1",
      error: null,
      requested_by: "seed-pm",
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
    },
  ]);
}

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;

  await seedInvoiceEvents(knex);
  await seedInsights(knex);
}
