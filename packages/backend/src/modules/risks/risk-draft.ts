import { z } from "zod";
import type { LlmMessage } from "../../lib/llm.ts";
import { RISK_IMPACTS, RISK_LIKELIHOODS, type DraftedRisk, type RiskDraftContext } from "./types.ts";

export const draftedRiskSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(600),
  likelihood: z.enum(RISK_LIKELIHOODS),
  impact: z.enum(RISK_IMPACTS),
  mitigation: z.string().min(3).max(600),
});

export const riskDraftSchema = z.object({
  risks: z.array(draftedRiskSchema).min(1).max(20),
});

export type RiskDraftResponse = z.infer<typeof riskDraftSchema>;

// The prompt asks for a register a site manager would recognise: specific to
// this job's structure and programme, not a generic list. Every row is a draft;
// the person editing the register is the authority, so the model is told to
// be concrete rather than exhaustive.
export function riskDraftMessages(ctx: RiskDraftContext): LlmMessage[] {
  const facts = [
    `Project: ${ctx.title}`,
    ctx.location ? `Location: ${ctx.location}` : null,
    ctx.structure ? `Structure: ${ctx.structure}` : null,
    ctx.brief ? `Client brief: ${ctx.brief.slice(0, 1500)}` : null,
    ctx.programmeTasks.length > 0
      ? `Programme of work (top-level tasks): ${ctx.programmeTasks.slice(0, 40).join("; ")}`
      : "No programme drafted yet.",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "You are a construction risk manager preparing a pre-construction risk register for a contractor in Lagos, Nigeria.",
        "Return between 6 and 14 risks that are specific to this job: site and ground conditions, access and logistics, weather and flooding, programme and sequencing, procurement of imported items, statutory approvals (LASPPPA, LASBCA), payment and cash flow, health and safety on the named activities, and community or security issues where relevant.",
        "Each risk needs a short title, a one or two sentence description of the cause and effect, a likelihood and an impact (low, medium, high), and a concrete mitigation the contractor can action before or during the work.",
        "Do not invent facts about the site that are not in the brief; phrase unknowns as conditions to verify.",
        'Respond with JSON only: {"risks":[{"title":"...","description":"...","likelihood":"low|medium|high","impact":"low|medium|high","mitigation":"..."}]}',
      ].join(" "),
    },
    { role: "user", content: facts },
  ];
}

export function toDraftedRisks(response: RiskDraftResponse): DraftedRisk[] {
  return response.risks;
}
