import type { AgentRepository } from "./repository.ts";

export interface ProjectSnapshot {
  projectId: string;
  name: string;
  status: string;
  currency: string;
  progressPercent: number;
  budgetTotal: number;
  budgetUsed: number;
  address: string;
  phaseCount: number;
  activityCount: number;
  completedActivities: number;
  inProgressActivities: number;
  milestoneCount: number;
  openDelays: number;
  delayCostImpact: number;
  risksBySeverity: Record<string, number>;
  upcomingKeyDates: number;
  documentCount: number;
  recentDailyLogs: number;
  fromProgrammeImport: boolean;
  /**
   * Sections the asking user may not read. Their counts are zero here because
   * nothing was fetched, NOT because the project has none — so the prompt
   * leaves those lines out entirely rather than stating a false zero.
   */
  withheld: SnapshotSection[];
}

export type SnapshotSection =
  | "phases"
  | "programme"
  | "risks"
  | "keyDates"
  | "documents"
  | "dailyLogs";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** May the asking user read this resource/action on the project? */
export type SnapshotPermission = (resource: string, action: string) => boolean;

/**
 * The snapshot goes straight into the system prompt, so it is a read path like
 * any other and obeys the same permissions the tools do. A participant with no
 * risks:view gets no risk counts here either — otherwise the assistant could
 * answer from the preamble what it would have refused to fetch.
 */
export async function buildSnapshot(
  repo: AgentRepository,
  projectId: string,
  can: SnapshotPermission,
): Promise<ProjectSnapshot | null> {
  const project = await repo.projectInfo(projectId);
  if (!project) return null;

  const none = <T,>(): Promise<T[]> => Promise.resolve([]);
  const maySeeProgramme = can("schedule", "view");
  const withheld: SnapshotSection[] = [];
  if (!can("stages", "view")) withheld.push("phases");
  if (!maySeeProgramme) withheld.push("programme");
  if (!can("risks", "view")) withheld.push("risks");
  if (!can("key-dates", "view")) withheld.push("keyDates");
  if (!can("documents", "view")) withheld.push("documents");
  if (!can("dailyLog", "view")) withheld.push("dailyLogs");
  const [phases, activities, delays, risks, keyDates, documents, dailyLogs] = await Promise.all([
    can("stages", "view") ? repo.phases(projectId) : none<Awaited<ReturnType<typeof repo.phases>>[number]>(),
    maySeeProgramme ? repo.activities(projectId) : none<Awaited<ReturnType<typeof repo.activities>>[number]>(),
    maySeeProgramme ? repo.delays(projectId) : none<Awaited<ReturnType<typeof repo.delays>>[number]>(),
    can("risks", "view") ? repo.risks(projectId) : none<Awaited<ReturnType<typeof repo.risks>>[number]>(),
    can("key-dates", "view") ? repo.keyDates(projectId) : none<Awaited<ReturnType<typeof repo.keyDates>>[number]>(),
    can("documents", "view") ? repo.documents(projectId) : none<Awaited<ReturnType<typeof repo.documents>>[number]>(),
    can("dailyLog", "view") ? repo.dailyLogs(projectId, 30) : none<Awaited<ReturnType<typeof repo.dailyLogs>>[number]>(),
  ]);

  const risksBySeverity: Record<string, number> = {};
  for (const r of risks) {
    const sev = String((r as { severity: string }).severity ?? "Unknown");
    risksBySeverity[sev] = (risksBySeverity[sev] ?? 0) + 1;
  }

  const now = Date.now();
  const recentCutoff = now - 14 * 86_400_000;

  const setup = project.setup as { source?: string } | null;

  return {
    projectId,
    name: project.name,
    status: project.status,
    currency: project.currency,
    progressPercent: num(project.progress_percent),
    budgetTotal: num(project.budget_total),
    budgetUsed: num(project.budget_used),
    address: project.address,
    phaseCount: phases.length,
    activityCount: activities.length,
    completedActivities: activities.filter((a) => (a as { status: string }).status === "Completed").length,
    inProgressActivities: activities.filter((a) => (a as { status: string }).status === "InProgress").length,
    milestoneCount: activities.filter((a) => (a as { is_milestone: boolean }).is_milestone).length,
    openDelays: delays.filter((d) => (d as { resolved_at: unknown }).resolved_at === null).length,
    delayCostImpact: delays.reduce((sum, d) => sum + num((d as { cost_impact: unknown }).cost_impact), 0),
    risksBySeverity,
    upcomingKeyDates: keyDates.filter((k) => {
      const t = (k as { target_date: unknown }).target_date;
      const status = (k as { status: string }).status;
      return status !== "Met" && t != null && new Date(String(t)).getTime() >= now;
    }).length,
    documentCount: documents.length,
    recentDailyLogs: dailyLogs.filter((l) => {
      const c = (l as { log_date: unknown }).log_date;
      return c != null && new Date(String(c)).getTime() >= recentCutoff;
    }).length,
    fromProgrammeImport: setup?.source === "programme-import",
    withheld,
  };
}

export function snapshotToPrompt(s: ProjectSnapshot): string {
  const risks = Object.entries(s.risksBySeverity)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ") || "none";
  const hidden = new Set<SnapshotSection>(s.withheld);
  // A withheld section is omitted, never printed as a zero: "0 open delays"
  // would be a fact the assistant could repeat, and it was never read.
  const lines = [
    `PROJECT SNAPSHOT (current state):`,
    `- Name: ${s.name}`,
    `- Status: ${s.status} (${s.progressPercent}% complete)`,
    `- Location: ${s.address}`,
    `- Budget: ${s.budgetUsed} spent of ${s.budgetTotal} ${s.currency}`,
  ];
  if (!hidden.has("phases")) lines.push(`- Phases: ${s.phaseCount}`);
  if (!hidden.has("programme")) {
    lines.push(
      `- Activities: ${s.activityCount} total (${s.completedActivities} completed, ${s.inProgressActivities} in progress, ${s.milestoneCount} milestones)`,
      `- Delays: ${s.openDelays} open, ${s.delayCostImpact} ${s.currency} total cost impact`,
    );
  }
  if (!hidden.has("risks")) lines.push(`- Risks: ${risks}`);
  if (!hidden.has("keyDates")) lines.push(`- Upcoming key dates: ${s.upcomingKeyDates}`);
  if (!hidden.has("documents")) lines.push(`- Documents on file: ${s.documentCount}`);
  if (!hidden.has("dailyLogs")) lines.push(`- Daily logs in last 14 days: ${s.recentDailyLogs}`);
  if (hidden.size > 0) {
    lines.push(
      `- Not shown (this user's role does not open them): ${[...hidden].join(", ")}. Say you cannot see these rather than assuming there are none.`,
    );
  }
  return lines.join("\n");
}
