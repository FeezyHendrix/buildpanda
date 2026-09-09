import { z } from "zod";
import type { LlmMessage } from "../../lib/llm.ts";
import type { SafetyDraftContext } from "./types.ts";

// Activities that warrant a written method statement on a small building job.
// Names come from the drafted programme, so matching is by keyword, not id.
export const HIGH_RISK_PATTERN =
  /demoli|excavat|trench|height|roof|scaffold|lift|crane|hoist|electric|hot\s*work|weld|confined|pile|formwork|steel\s*erect/i;

export function highRiskTasks(taskNames: string[]): string[] {
  const seen = new Set<string>();
  return taskNames.filter((name) => {
    if (!HIGH_RISK_PATTERN.test(name)) return false;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const stepSchema = z.object({
  text: z.string().min(3).max(400),
  controls: z.string().max(400),
  ppe: z.string().max(200),
});

export const methodStatementDraftSchema = z.object({
  statements: z
    .array(
      z.object({
        activityName: z.string().min(3).max(120),
        hazards: z.array(z.string().min(2).max(160)).min(1).max(12),
        steps: z.array(stepSchema).min(2).max(15),
      }),
    )
    .min(1)
    .max(12),
});
export type MethodStatementDraftResponse = z.infer<typeof methodStatementDraftSchema>;

export const phasePlanDraftSchema = z.object({
  keyDatesNote: z.string().max(600),
  siteRules: z.string().max(1500),
  welfare: z.string().max(800),
  firstAid: z.string().max(600),
  servicesIsolation: z.string().max(600),
  asbestosNote: z.string().max(400),
  hazards: z.array(z.string().min(2).max(160)).max(15),
  supervision: z.string().max(600),
});
export type PhasePlanDraftResponse = z.infer<typeof phasePlanDraftSchema>;

function jobFacts(ctx: SafetyDraftContext): string {
  return [
    `Project: ${ctx.title}`,
    ctx.location ? `Location: ${ctx.location}` : null,
    ctx.structure ? `Structure: ${ctx.structure}` : null,
    ctx.brief ? `Client brief: ${ctx.brief.slice(0, 1200)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function methodStatementMessages(ctx: SafetyDraftContext, activities: string[]): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a construction health and safety lead writing method statements for a contractor in Lagos, Nigeria.",
        "For each activity listed, write one method statement: the hazards specific to that activity on this job, and an ordered sequence of steps a site supervisor would brief the gang with. Each step names the control measure and the PPE for that step.",
        "Be concrete and practical for a small residential or commercial site: named plant, exclusion zones, permits to dig or work at height, isolation of services, competent persons, weather stops. Avoid boilerplate.",
        "Use the activity name exactly as given.",
        'Respond with JSON only: {"statements":[{"activityName":"...","hazards":["..."],"steps":[{"text":"...","controls":"...","ppe":"..."}]}]}',
      ].join(" "),
    },
    { role: "user", content: `${jobFacts(ctx)}\nActivities: ${activities.join("; ")}` },
  ];
}

export function phasePlanMessages(ctx: SafetyDraftContext): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a construction health and safety lead drafting a construction phase plan for a small building project in Lagos, Nigeria, following the structure of the HSE CIS80 small-projects template.",
        "Fill every field with site-specific text: key dates note (what must be in place before start), site rules, welfare arrangements, first aid, isolation of existing services, an asbestos or hazardous-materials note, the main hazards for this job, and supervision arrangements.",
        "Where facts are unknown, state what must be confirmed rather than inventing them.",
        'Respond with JSON only: {"keyDatesNote":"...","siteRules":"...","welfare":"...","firstAid":"...","servicesIsolation":"...","asbestosNote":"...","hazards":["..."],"supervision":"..."}',
      ].join(" "),
    },
    {
      role: "user",
      content: `${jobFacts(ctx)}\nProgramme tasks: ${ctx.programmeTasks.slice(0, 40).join("; ") || "not drafted yet"}`,
    },
  ];
}
