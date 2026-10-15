import { agentRepository } from "./repository.ts";
import { fn, round2, tool, type AgentTool } from "./tool-helpers.ts";

export function contractTools(): AgentTool[] {
  return [
    tool(fn("get_payment_claims", "Get the project's payment claims (progress claims): claim number, workflow status (Draft/Submitted/Approved/Rejected/Paid), claimed and approved amounts, claim period and linked milestone. Use for questions about progress claims, what has been claimed or approved for payment."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const claims = await repo.paymentClaims(ctx.projectId);
      return {
        output: claims.map((c) => {
          const amount = Number(c.amount ?? 0);
          const approved = c.status === "Approved" || c.status === "Paid";
          return {
            id: c.id,
            claimNumber: c.claim_number,
            status: c.status,
            claimedAmount: amount,
            approvedAmount: approved ? amount : null,
            periodStart: c.period_start,
            periodEnd: c.period_end,
            submittedAt: c.submitted_at,
            approvedAt: c.approved_at,
            milestone: c.milestone_name ?? null,
          };
        }),
      };
    }),

    tool(fn("get_retention", "Get the project's retention position: the retention rate, amount currently held, and the staged releases — Stage 1 (Practical Completion) and Stage 2 (Defects Liability) — with their status. Use for questions about retention, money withheld from payments, or when retention is released. BuildPanda only LOGS these figures; it does not move money."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const [settings, releases] = await Promise.all([
        repo.paymentSettings(ctx.projectId),
        repo.retentionReleases(ctx.projectId),
      ]);
      return {
        output: {
          retentionRatePct: Number(settings?.retention_rate ?? 0),
          retentionHeld: Number(settings?.retention_held ?? 0),
          releasedPracticalCompletion: Number(settings?.retention_released_pc ?? 0),
          releasedDefectsLiability: Number(settings?.retention_released_dl ?? 0),
          releases: releases.map((r) => ({
            stage: Number(r.stage) === 1 ? "Practical Completion" : "Defects Liability",
            amount: Number(r.amount ?? 0),
            status: r.status,
            releasedAt: r.released_at,
            notes: r.notes,
          })),
        },
      };
    }),

    tool(fn("get_advance", "Get the project's mobilization advance position: the advance recorded, the amount still outstanding, the recovery (amortization) method, and each recovery logged against milestone certifications. Use for questions about the mobilization advance, upfront payment, or how much advance is left to recover. BuildPanda only LOGS these figures; it does not move money."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const [settings, amortizations] = await Promise.all([
        repo.paymentSettings(ctx.projectId),
        repo.advanceAmortizations(ctx.projectId),
      ]);
      const advance = Number(settings?.mobilization_advance ?? 0);
      const outstanding = Number(settings?.mobilization_outstanding ?? 0);
      return {
        output: {
          advanceRecorded: advance,
          outstanding,
          recovered: round2(advance - outstanding),
          recoveryMethod: settings?.mobilization_amort_type ?? null,
          recoveryValue: Number(settings?.mobilization_amort_value ?? 0),
          recoveries: amortizations.map((a) => ({
            amount: Number(a.amount ?? 0),
            recoveredAt: a.recovered_at,
            milestone: a.milestone_name ?? null,
          })),
        },
      };
    }),

    tool(fn("get_measured_work", "Get the project's measured work valuations (remeasurement/unit-rate records): description, quantity, unit rate, amount, valuation period and status (Draft/Certified/Invoiced), plus certified totals. Use for questions about measured work, unit-rate valuations, what has been certified, or remeasurement progress."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const records = await repo.measuredWork(ctx.projectId);
      const rows = records.map((r) => ({
        description: r.description,
        unit: r.unit,
        quantity: Number(r.quantity ?? 0),
        unitRate: Number(r.unit_rate ?? 0),
        amount: Number(r.amount ?? 0),
        periodStart: r.period_start,
        periodEnd: r.period_end,
        status: r.status,
        certifiedAt: r.certified_at,
      }));
      const totalFor = (status: string): number =>
        round2(rows.filter((r) => r.status === status).reduce((sum, r) => sum + r.amount, 0));
      return {
        output: {
          records: rows,
          totals: { draft: totalFor("Draft"), certified: totalFor("Certified"), invoiced: totalFor("Invoiced") },
        },
      };
    }),
  ];
}
