import { GET_PRECON_BOQ_DESCRIPTION, preconBoqLines } from "./precon-boq.ts";
import { preconWorkbookNotes } from "./precon-workbook.ts";
import { agentRepository } from "./repository.ts";
import { fn, tool, type AgentTool } from "./tool-helpers.ts";

export function preconstructionTools(): AgentTool[] {
  return [
    tool(fn("get_precon_boq", GET_PRECON_BOQ_DESCRIPTION), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const [lines, workbooks] = await Promise.all([
        preconBoqLines(repo, ctx.projectId),
        preconWorkbookNotes(repo, ctx.db, ctx.projectId),
      ]);
      return { output: { lines, ...workbooks } };
    }),

    tool(fn("get_boq_items", "Get Bill of Quantities (BoQ) line items from the accepted/converted proposal for this project, including description, group, quantity and unit. Use for BoQ quantity questions such as total doors, blocks, tiles, fixtures, or any 'how many/how much is in the BoQ' question. This is the planned BoQ, not procurement orders or live stock."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const items = await repo.boqItems(ctx.projectId);
      return {
        output: items.map((item) => ({
          proposalId: item.proposal_id,
          proposalTitle: item.proposal_title,
          proposalStatus: item.proposal_status,
          group: item.group_label,
          description: item.description,
          quantity: Number(item.qty ?? 0),
          unit: item.unit,
        })),
      };
    }),

    tool(fn("get_estimate", "Get the accepted estimate this project was converted from: revision, status, contract total, contingency and tax, every priced line (group, description, quantity, unit, rate, total) and the agreed payment stages (label and percent of contract). Use for 'what did we agree with the client', 'what was priced for X', 'what are the payment stages', or contract sum questions. Rates here are the client-facing agreed rates, not live spend."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const result = await repo.acceptedEstimate(ctx.projectId);
      if (!result) return { output: { estimate: null, note: "No estimate is linked to this project." } };
      const { estimate, items, schedule } = result;
      return {
        output: {
          proposalTitle: estimate.proposal_title,
          revision: `Rev ${estimate.revision_no}`,
          status: estimate.status,
          currency: estimate.currency,
          subtotal: Number(estimate.subtotal),
          contingencyPct: Number(estimate.contingency_pct),
          taxLabel: estimate.tax_label,
          taxPct: Number(estimate.tax_pct),
          taxAmount: Number(estimate.tax_amount),
          total: Number(estimate.total),
          acceptedAt: estimate.accepted_at,
          acceptedBy: estimate.accepted_by_name,
          items: items.map((i) => ({ group: i.group_label, description: i.description, quantity: Number(i.qty), unit: i.unit, rate: Number(i.unit_rate), total: Number(i.total) })),
          paymentStages: schedule.map((s) => ({ label: s.label, percent: Number(s.percent), amount: Math.round((Number(estimate.total) * Number(s.percent)) / 100), description: s.description })),
        },
      };
    }),
  ];
}
