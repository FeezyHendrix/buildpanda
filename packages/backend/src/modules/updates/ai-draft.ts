import type { Knex } from "knex";
import { z } from "zod";
import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { isPandaAiConfigured, pandaAiJson } from "../panda-ai/engine.ts";

const aiDraftBodySchema = z.object({ body: z.unknown().optional() });
import { updatesRepository } from "./repository.ts";
import { CTA_DEFAULTS, toUpdate } from "./service.ts";
import type { ProjectUpdate, UpdateMediaRow } from "./types.ts";

export const WEEKLY_DRAFT_KIND = "weekly";

const LOOKBACK_DAYS = 7;
const UPCOMING_DAYS = 14;
const MAX_PHOTOS = 6;
// Update descriptions are edited through the route schema, which caps at 2000.
const MAX_BODY_LENGTH = 2000;

const SYSTEM_AUTHOR = { id: "panda-ai", name: "Panda AI", role: "AI Assistant" } as const;

export interface WeeklyDraftContext {
  projectName: string;
  progressPercent: number;
  rangeStart: string;
  rangeEnd: string;
  dailyLogs: Array<{
    date: string;
    summary: string | null;
    workersPresent: number;
    weather: string | null;
  }>;
  currentStage: string | null;
  completedActivities: string[];
  upcomingKeyDates: Array<{ label: string; date: string }>;
  pendingApprovals: number;
  openQueries: number;
  photoUrls: string[];
}

const SYSTEM_PROMPT = [
  "You are Panda AI, drafting a weekly progress update that a builder will review and send to the homeowner of a residential construction project.",
  "Write in warm, plain English a homeowner understands — no construction jargon, no hype.",
  "Use ONLY the facts in the provided JSON. Never invent work, dates, amounts or people that are not in the data. Repeat any dates and numbers exactly as given.",
  "Structure the update as short plain-text paragraphs separated by blank lines: first what happened this week, then what is coming next, and — only if there are pending approvals or open questions — a final paragraph about decisions needed from the homeowner.",
  "No markdown, no headings, no bullet symbols, no emojis. Keep the whole update under 1800 characters.",
  'Respond with JSON: {"body": "<the update text>"}.',
].join(" ");

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function draftTitle(start: Date, end: Date): string {
  return `Weekly update — ${formatDay(start)} to ${formatDay(end)}`;
}

async function gatherWeeklyContext(
  db: Knex,
  projectId: string,
  start: Date,
  end: Date,
): Promise<WeeklyDraftContext> {
  const project = await db("projects")
    .where({ id: projectId })
    .first<{ name: string; progress_percent: number } | undefined>("name", "progress_percent");
  if (!project) throw new NotFoundError("Project");

  const [logs, stage, completed, keyDates, approvalRow, queryRow, photos] = await Promise.all([
    db("daily_logs")
      .where({ project_id: projectId })
      .where("log_date", ">=", isoDate(start))
      .orderBy("log_date", "asc")
      .select<Array<{ log_date: Date | string; summary: string | null; workers_present: number; weather_condition: string | null }>>(
        "log_date",
        "summary",
        "workers_present",
        "weather_condition",
      ),
    db("project_phases")
      .where({ project_id: projectId, status: "InProgress" })
      .orderBy("sort_order", "asc")
      .first<{ name: string } | undefined>("name"),
    db("activities")
      .where({ project_id: projectId, status: "Completed" })
      .where("actual_end_at", ">=", start)
      .orderBy("actual_end_at", "asc")
      .limit(20)
      .select<Array<{ name: string }>>("name"),
    db("key_dates")
      .where({ project_id: projectId })
      .whereIn("status", ["Upcoming"])
      .whereNotNull("target_date")
      .where("target_date", ">=", isoDate(end))
      .where("target_date", "<=", isoDate(new Date(end.getTime() + UPCOMING_DAYS * 86_400_000)))
      .orderBy("target_date", "asc")
      .limit(10)
      .select<Array<{ label: string; target_date: Date | string }>>("label", "target_date"),
    db("approvals")
      .where({ project_id: projectId })
      .whereIn("status", ["Pending", "Resubmit"])
      .count({ count: "*" })
      .first<{ count: string | number } | undefined>(),
    db("queries")
      .where({ project_id: projectId })
      .whereNot("status", "Closed")
      .count({ count: "*" })
      .first<{ count: string | number } | undefined>(),
    db("update_media as m")
      .join("project_updates as u", "u.id", "m.update_id")
      .where("u.project_id", projectId)
      .where("u.is_draft", false)
      .where("u.created_at", ">=", start)
      .where("m.type", "photo")
      .orderBy("u.created_at", "desc")
      .limit(MAX_PHOTOS)
      .select<Array<{ url: string }>>("m.url"),
  ]);

  return {
    projectName: project.name,
    progressPercent: Number(project.progress_percent ?? 0),
    rangeStart: isoDate(start),
    rangeEnd: isoDate(end),
    dailyLogs: logs.map((log) => ({
      date: isoDate(new Date(log.log_date)),
      summary: log.summary,
      workersPresent: log.workers_present,
      weather: log.weather_condition,
    })),
    currentStage: stage?.name ?? null,
    completedActivities: completed.map((activity) => activity.name),
    upcomingKeyDates: keyDates.map((keyDate) => ({
      label: keyDate.label,
      date: isoDate(new Date(keyDate.target_date)),
    })),
    pendingApprovals: Number(approvalRow?.count ?? 0),
    openQueries: Number(queryRow?.count ?? 0),
    photoUrls: photos.map((photo) => photo.url),
  };
}

// Deterministic body used when no LLM API key is configured (dev mode) or the
// LLM call yields nothing usable — assembled from the same gathered data.
export function buildFallbackBody(context: WeeklyDraftContext): string {
  const lines: string[] = ["What happened this week:"];

  if (context.currentStage) {
    lines.push(`- Current stage: ${context.currentStage}.`);
  }
  if (context.dailyLogs.length > 0) {
    lines.push(`- ${context.dailyLogs.length} site day(s) were logged.`);
    for (const log of context.dailyLogs.slice(-5)) {
      if (log.summary) lines.push(`- ${log.date}: ${log.summary}`);
    }
  }
  for (const name of context.completedActivities) {
    lines.push(`- Completed: ${name}.`);
  }
  if (lines.length === 1) {
    lines.push("- No site activity was recorded this week.");
  }

  lines.push("", "What's coming next:");
  if (context.upcomingKeyDates.length > 0) {
    for (const keyDate of context.upcomingKeyDates) {
      lines.push(`- ${keyDate.label} — ${keyDate.date}.`);
    }
  } else {
    lines.push("- No key dates are scheduled in the next two weeks.");
  }

  if (context.pendingApprovals > 0 || context.openQueries > 0) {
    lines.push("", "Decisions we need from you:");
    if (context.pendingApprovals > 0) {
      lines.push(`- ${context.pendingApprovals} approval(s) are waiting for your decision.`);
    }
    if (context.openQueries > 0) {
      lines.push(`- ${context.openQueries} question(s) are still open.`);
    }
  }

  return lines.join("\n").slice(0, MAX_BODY_LENGTH);
}

async function generateBody(context: WeeklyDraftContext): Promise<string> {
  if (isPandaAiConfigured()) {
    const result = await pandaAiJson(
      SYSTEM_PROMPT,
      JSON.stringify(context),
      aiDraftBodySchema,
    );
    const body = result?.body;
    if (typeof body === "string" && body.trim().length > 0) {
      return body.trim().slice(0, MAX_BODY_LENGTH);
    }
  }
  return buildFallbackBody(context);
}

export interface WeeklyDraftResult {
  update: ProjectUpdate;
  created: boolean;
}

export function aiDraftService(db: Knex) {
  const repository = updatesRepository(db);

  return {
    /**
     * Generates (or returns the existing) weekly homeowner-update draft for a
     * project. `requestedBy` is null for the scheduled path, which attributes
     * the draft to a system author the builder can edit before publishing.
     */
    async generateClientUpdateDraft(input: {
      projectId: string;
      requestedBy: { id: string; name: string } | null;
    }): Promise<WeeklyDraftResult> {
      const end = new Date();
      const start = new Date(end.getTime() - LOOKBACK_DAYS * 86_400_000);

      const existing = await repository.findDraftByKind(
        input.projectId,
        WEEKLY_DRAFT_KIND,
        start,
      );
      if (existing) {
        const existingMedia = await repository.mediaForUpdates([existing.id]);
        return { update: toUpdate(existing, existingMedia), created: false };
      }

      const context = await gatherWeeklyContext(db, input.projectId, start, end);
      const body = await generateBody(context);

      const author = input.requestedBy
        ? { ...input.requestedBy, role: "Project Manager" }
        : SYSTEM_AUTHOR;
      const updateId = generateId("update");
      const media: UpdateMediaRow[] = context.photoUrls.map((url, index) => ({
        id: generateId("media"),
        update_id: updateId,
        type: "photo",
        url,
        sort_order: index,
      }));

      const row = await repository.createUpdate(
        {
          id: updateId,
          project_id: input.projectId,
          author_id: author.id,
          author_name: author.name,
          author_role: author.role,
          author_initials_tone: "brand",
          activity_id: null,
          category: "Progress",
          title: draftTitle(start, end),
          description: body,
          description_html: null,
          cta_label: CTA_DEFAULTS.Progress.label,
          cta_tone: CTA_DEFAULTS.Progress.tone,
          status: "Open",
          is_draft: true,
          generated_kind: WEEKLY_DRAFT_KIND,
          created_at: new Date(),
        },
        media,
      );
      return { update: toUpdate(row, media), created: true };
    },
  };
}

export type AiDraftService = ReturnType<typeof aiDraftService>;
