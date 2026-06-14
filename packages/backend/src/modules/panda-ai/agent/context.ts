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
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function buildSnapshot(
  repo: AgentRepository,
  projectId: string,
): Promise<ProjectSnapshot | null> {
  const project = await repo.projectInfo(projectId);
  if (!project) return null;

  const [phases, activities, delays, risks, keyDates, documents, dailyLogs] = await Promise.all([
    repo.phases(projectId),
    repo.activities(projectId),
    repo.delays(projectId),
    repo.risks(projectId),
    repo.keyDates(projectId),
    repo.documents(projectId),
    repo.dailyLogs(projectId, 30),
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
  };
}

export function snapshotToPrompt(s: ProjectSnapshot): string {
  const risks = Object.entries(s.risksBySeverity)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ") || "none";
  return [
    `PROJECT SNAPSHOT (current state):`,
    `- Name: ${s.name}`,
    `- Status: ${s.status} (${s.progressPercent}% complete)`,
    `- Location: ${s.address}`,
    `- Budget: ${s.budgetUsed} spent of ${s.budgetTotal} ${s.currency}`,
    `- Phases: ${s.phaseCount}`,
    `- Activities: ${s.activityCount} total (${s.completedActivities} completed, ${s.inProgressActivities} in progress, ${s.milestoneCount} milestones)`,
    `- Delays: ${s.openDelays} open, ${s.delayCostImpact} ${s.currency} total cost impact`,
    `- Risks: ${risks}`,
    `- Upcoming key dates: ${s.upcomingKeyDates}`,
    `- Documents on file: ${s.documentCount}`,
    `- Daily logs in last 14 days: ${s.recentDailyLogs}`,
  ].join("\n");
}
