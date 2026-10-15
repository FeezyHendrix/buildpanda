import { agentRecordScope, expenseScopeLabel } from "./record-scope.ts";
import { financesRepository } from "../../finances/repository.ts";
import { stageCostsService } from "../../finances/stage-costs.ts";
import { purchaseOrdersRepository } from "../../purchase-orders/repository.ts";
import { transactionsRepository } from "../../transactions/repository.ts";
import { agentRepository } from "./repository.ts";
import { fn, round2, tool, type AgentTool } from "./tool-helpers.ts";
import { canRead } from "./tool-permissions.ts";
import { optionalString } from "./tool-input.ts";

export function expensesTools(): AgentTool[] {
  return [
    tool(fn("get_finances", "Get the project budget, spend, escrow, milestone payments and cost-to-stage (what each build stage has cost: committed = issued purchase orders, actual = logged expenses). Use for questions about money, budget, cashflow, payments, or what a stage has cost."), async (ctx) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
      // Cost-to-stage is the contractor's own position — GET
      // /projects/:id/finances/stage-costs takes finances:viewCosts, not the
      // plain finances:view that opens the rest of this tool.
      const maySeeCosts = canRead(ctx, "finances", "viewCosts");
      const [fin, milestones, stageCosts, stages] = await Promise.all([
        repo.finances(ctx.projectId),
        repo.milestonePayments(ctx.projectId),
        maySeeCosts
          ? stageCostsService({
              finances: financesRepository(ctx.db),
              transactions: transactionsRepository(ctx.db, agentRecordScope(ctx).expenseReaderId),
              purchaseOrders: purchaseOrdersRepository(ctx.db),
            }).byProject(ctx.projectId).catch(() => ({ stages: [] }))
          : Promise.resolve({ stages: [] }),
        maySeeCosts ? repo.stageNames(ctx.projectId) : Promise.resolve([]),
      ]);
      const stageName = new Map(stages.map((s) => [s.id, s.name]));
      return {
        output: {
          expenseVisibility: expenseScopeLabel(ctx),
          finances: fin ?? null,
          milestonePayments: milestones.map((m) => ({
            name: m.name,
            status: m.status,
            percentComplete: Number(m.percent_complete ?? 0),
            amount: Number(m.amount ?? 0),
            verified: Boolean(m.proof_verified),
          })),
          costToStage: stageCosts.stages.map((c) => ({
            stage: stageName.get(c.stageId) ?? c.stageId,
            committed: c.committed,
            actual: c.actual,
            currency: c.currency,
          })),
          notPermitted: maySeeCosts ? [] : ["costToStage"],
        },
      };
    }),

    tool(fn("get_finance_events", "Get the funding trail — a chronological log of who did what on this project's finances (funded the project, released a milestone from escrow, created/updated/removed a milestone, raised a dispute), with the actor and when. Use for questions about finance activity, history, or who recorded a funding action. Note: BuildPanda only LOGS these actions; it does not move money."), async (ctx) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
      const rows = (await repo.financeEvents(ctx.projectId)) as {
        type: string;
        actor_name: string;
        summary: string;
        amount: string | null;
        created_at: string;
      }[];
      return {
        output: rows.map((r) => ({
          action: r.summary,
          by: r.actor_name,
          amount: r.amount === null ? null : Number(r.amount),
          at: r.created_at,
        })),
      };
    }),

    tool(fn("list_transactions", "List the project's logged expenditures (materials, labour, equipment, subcontractor, transport, permits_fees, utilities, professional_services, preliminaries, overhead, miscellaneous or any custom category the org added). Each entry is a real-world expense the team recorded — with title, description, category, amount, vendor, date transacted and reference. Also returns a rollup of totals per category and an overall total. Use for questions like 'how much did we spend on X', 'top spending categories', 'recent expenses', 'what did we spend this month'. Note: BuildPanda LOGS spend; it does not move money.", {
      category: { type: "string", description: "Optional exact category key or custom label to filter by (e.g. 'materials', 'labour', 'Scaffolding')." },
      from: { type: "string", description: "Optional ISO date (YYYY-MM-DD) inclusive lower bound on transacted_at." },
      to: { type: "string", description: "Optional ISO date (YYYY-MM-DD) inclusive upper bound on transacted_at." },
      limit: { type: "integer", minimum: 1, maximum: 500, description: "Optional cap on returned entries (default 200)." },
    }), async (ctx, args) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
      const category = optionalString(args.category, 200) ?? undefined;
      const from = optionalString(args.from, 30) ?? undefined;
      const to = optionalString(args.to, 30) ?? undefined;
      const limit = typeof args.limit === "number" ? Math.max(1, Math.min(500, Math.trunc(args.limit))) : undefined;

      const [rows, totals] = await Promise.all([
        repo.transactions(ctx.projectId, { category, from, to, limit }),
        repo.transactionTotalsByCategory(ctx.projectId, { from, to }),
      ]);

      const typedRows = rows as Array<{
        id: string;
        title: string;
        description: string | null;
        category: string;
        category_type: string;
        amount: string;
        transacted_at: string;
        vendor: string | null;
        reference: string | null;
        created_at: string;
      }>;
      const typedTotals = totals as Array<{ category: string; total: string; count: string }>;

      const overallTotal = typedTotals.reduce((sum, t) => sum + Number(t.total), 0);

      return {
        output: {
          expenseVisibility: expenseScopeLabel(ctx),
          transactions: typedRows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            category: r.category,
            categoryType: r.category_type,
            amount: round2(Number(r.amount)),
            transactedAt: r.transacted_at,
            vendor: r.vendor,
            reference: r.reference,
          })),
          totalsByCategory: typedTotals.map((t) => ({
            category: t.category,
            total: round2(Number(t.total)),
            count: Number(t.count),
          })),
          overallTotal: round2(overallTotal),
          count: typedRows.length,
        },
        navigate: "transactions",
      };
    }),

    tool(fn("get_budget", "Get the project's budget categories with allocated (planned), committed and actual/spent amounts plus variance and remaining per category, and overall totals. Use for questions about budget lines, cost codes, where money is over/under budget. get_finances is only the high-level summary."), async (ctx) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
      const rows = await repo.budgetCategories(ctx.projectId);
      const categories = rows.map((c) => {
        const allocated = Number(c.planned ?? 0);
        const committed = Number(c.committed ?? 0);
        const spent = Number(c.actual ?? 0);
        return {
          name: c.name,
          costCode: c.cost_code,
          allocated,
          committed,
          spent,
          variance: round2(allocated - spent),
          remaining: round2(allocated - committed - spent),
          overBudget: spent > allocated,
        };
      });
      const sum = (pick: (c: (typeof categories)[number]) => number): number =>
        round2(categories.reduce((total, c) => total + pick(c), 0));
      return {
        output: {
          expenseVisibility: expenseScopeLabel(ctx),
          categories,
          totals: {
            allocated: sum((c) => c.allocated),
            committed: sum((c) => c.committed),
            spent: sum((c) => c.spent),
            variance: sum((c) => c.variance),
          },
        },
      };
    }),

    tool(fn("get_purchase_orders", "Get the project's purchase orders with vendor, status, committed total and expected delivery date. Use for questions about POs, what has been ordered from vendors, committed procurement spend, or expected deliveries."), async (ctx) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
      const orders = await repo.purchaseOrders(ctx.projectId);
      return {
        output: orders.map((po) => ({
          id: po.id,
          poNumber: po.po_number,
          vendor: po.vendor_name,
          status: po.status,
          total: round2(Number(po.total ?? 0)),
          orderDate: po.order_date,
          expectedDelivery: po.expected_date,
        })),
      };
    }),

    tool(fn("get_transaction_summary", "Get the project's transaction ledger summary: total spending, a breakdown of spending by category (how much was spent on materials, labor, equipment, etc.), and the most recent transactions. Use for questions about where money is being spent, what categories have the highest costs, or recent expense records. BuildPanda only LOGS these figures; it does not move money."), async (ctx) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
      const [analytics, recent, total] = await Promise.all([
        repo.transactionCategoryAnalytics(ctx.projectId),
        repo.transactionRecent(ctx.projectId, 15),
        repo.transactionTotal(ctx.projectId),
      ]);
      return {
        output: {
          expenseVisibility: expenseScopeLabel(ctx),
          totalSpent: total,
          categoryBreakdown: analytics.map((a) => ({
            category: a.category_name,
            total: Number(a.total),
            percentage: total > 0 ? Math.round((Number(a.total) / total) * 10000) / 100 : 0,
            transactionCount: Number(a.count),
          })),
          recentTransactions: recent.map((t) => ({
            id: t.id,
            title: t.title,
            amount: Number(t.amount),
            category: t.category_name,
            date: t.transaction_date,
          })),
        },
      };
    }),
  ];
}
