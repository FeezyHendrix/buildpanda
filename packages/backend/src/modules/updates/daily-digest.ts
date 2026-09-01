import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { dailyDigestRepository, MOVEMENT_HEADINGS } from "./daily-digest-repository.ts";
import { generateDigestBody } from "./daily-digest-body.ts";
import { updatesRepository } from "./repository.ts";
import { CTA_DEFAULTS, toUpdate } from "./service.ts";
import type {
  DailyDigestContext,
  DailyDigestDraft,
  DailyDigestOutcome,
  DigestRow,
  DigestSection,
} from "./types.ts";

export const DAILY_DIGEST_KIND = "daily";

const SYSTEM_AUTHOR = { id: "panda-ai", name: "Panda AI", role: "AI Assistant" } as const;

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// A digest day is a UTC calendar day, matching how daily_logs.log_date is
// stored and how every generated report already formats dates.
function dayWindow(digestDate: string): { from: Date; to: Date } {
  const from = new Date(`${digestDate}T00:00:00Z`);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

function formatDay(digestDate: string): string {
  return new Date(`${digestDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toItems(rows: DigestRow[]): string[] {
  return rows
    .filter((row): row is DigestRow & { label: string } => Boolean(row.label))
    .map((row) => (row.status ? `${row.label} (${row.status})` : row.label));
}

function section(heading: string, rows: DigestRow[]): DigestSection | null {
  const items = toItems(rows);
  return items.length > 0 ? { heading, items } : null;
}

function hasMovement(context: DailyDigestContext): boolean {
  return (
    context.sections.length > 0 ||
    context.siteNotes.length > 0 ||
    context.loggedActivities.length > 0 ||
    context.siteLog !== null
  );
}

export function dailyDigestService(db: Knex) {
  const repository = updatesRepository(db);
  const digest = dailyDigestRepository(db);

  async function buildContext(
    projectId: string,
    digestDate: string,
  ): Promise<DailyDigestContext> {
    const { from, to } = dayWindow(digestDate);

    const [
      project,
      stage,
      siteLog,
      siteNotes,
      loggedActivities,
      movements,
      tasksCreated,
      materials,
      markupsRaised,
      markupsResolved,
      finance,
    ] = await Promise.all([
      digest.project(projectId),
      digest.currentStage(projectId),
      digest.siteLog(projectId, digestDate),
      digest.siteNotes(projectId, digestDate),
      digest.loggedActivities(projectId, digestDate),
      digest.movements(projectId, from, to),
      digest.tasksCreated(projectId, from, to),
      digest.materialsLogged(projectId, from, to),
      digest.markupsRaised(projectId, from, to),
      digest.markupsResolved(projectId, from, to),
      digest.financeLogged(projectId, from, to),
    ]);

    if (!project) throw new NotFoundError("Project");

    const sections = [
      ...MOVEMENT_HEADINGS.map(({ key, heading }) => section(heading, movements[key])),
      section("Tasks added to the board", tasksCreated),
      section("Materials logged", materials),
      section("Drawing markups raised", markupsRaised),
      section("Drawing markups resolved", markupsResolved),
      section("Recorded against the money", finance),
    ].filter((entry): entry is DigestSection => entry !== null);

    return {
      projectName: project.name,
      digestDate,
      dateLabel: formatDay(digestDate),
      progressPercent: Number(project.progress_percent ?? 0),
      currentStage: stage?.name ?? null,
      siteLog: siteLog
        ? {
            weather: siteLog.weather_condition,
            temperatureC: siteLog.temperature_c === null ? null : Number(siteLog.temperature_c),
            workersExpected: siteLog.workers_expected,
            workersPresent: siteLog.workers_present,
            totalHours: Number(siteLog.total_hours),
          }
        : null,
      siteNotes: siteNotes.filter((note) => Boolean(note.body)),
      loggedActivities: loggedActivities.map((activity) => ({
        name: activity.name,
        hours: Number(activity.hours),
      })),
      sections,
    };
  }

  async function findExisting(
    projectId: string,
    digestDate: string,
  ): Promise<DailyDigestDraft | null> {
    const { from } = dayWindow(digestDate);
    const existing = await repository.findDraftByKind(projectId, DAILY_DIGEST_KIND, from);
    if (!existing) return null;
    const media = await repository.mediaForUpdates([existing.id]);
    return { status: "existing", update: toUpdate(existing, media) };
  }

  async function createDraft(
    context: DailyDigestContext,
    projectId: string,
    requestedBy: { id: string; name: string } | null,
  ): Promise<DailyDigestDraft> {
    const body = await generateDigestBody(context);
    const author = requestedBy
      ? { ...requestedBy, role: "Project Manager" }
      : SYSTEM_AUTHOR;

    const row = await repository.createUpdate(
      {
        id: generateId("update"),
        project_id: projectId,
        author_id: author.id,
        author_name: author.name,
        author_role: author.role,
        author_initials_tone: "brand",
        activity_id: null,
        category: "Progress",
        title: `Daily digest — ${context.dateLabel}`,
        description: body,
        description_html: null,
        cta_label: CTA_DEFAULTS.Progress.label,
        cta_tone: CTA_DEFAULTS.Progress.tone,
        status: "Open",
        is_draft: true,
        generated_kind: DAILY_DIGEST_KIND,
        created_at: new Date(),
      },
      [],
    );

    return { status: "created", update: toUpdate(row, []) };
  }

  return {
    buildContext,

    // An explicit ask always yields a draft, even for a quiet day.
    async generateDailyDigest(input: {
      projectId: string;
      digestDate: string;
      requestedBy: { id: string; name: string } | null;
    }): Promise<DailyDigestDraft> {
      const existing = await findExisting(input.projectId, input.digestDate);
      if (existing) return existing;
      const context = await buildContext(input.projectId, input.digestDate);
      return createDraft(context, input.projectId, input.requestedBy);
    },

    // The scheduled path stays silent on quiet days so drafts never pile up.
    async generateIfActive(input: {
      projectId: string;
      digestDate: string;
    }): Promise<DailyDigestOutcome> {
      const existing = await findExisting(input.projectId, input.digestDate);
      if (existing) return existing;
      const context = await buildContext(input.projectId, input.digestDate);
      if (!hasMovement(context)) return { status: "quiet" };
      return createDraft(context, input.projectId, null);
    },
  };
}

export type DailyDigestService = ReturnType<typeof dailyDigestService>;
