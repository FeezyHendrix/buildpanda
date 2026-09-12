import { KpiCard, type KpiTone } from "@/components/molecules/kpi-card";
import type { ProjectReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { formatCurrency, pct } from "@/lib/formatters";
import type { AutoWindowResult, Project, RiskFactor } from "@/lib/project-types";

/** Ernest flips a percentage card to the negative colour at 80% consumed. */
const BUDGET_DANGER_PCT = 80;
/** Below this the health score reads as a warning figure. */
const HEALTH_DANGER_SCORE = 50;
const EMPTY_VALUE = "—";

interface OverviewKpisProps {
  project: Project;
  risks: RiskFactor[];
  autoWindow: AutoWindowResult | undefined;
  snapshot: ProjectReportingSnapshot | undefined;
}

function budgetTone(used: number, total: number): KpiTone {
  return total > 0 && pct(used, total) >= BUDGET_DANGER_PCT ? "danger" : "default";
}

function riskTone(level: Project["risk"]): KpiTone {
  return level === "High" ? "danger" : "default";
}

function healthTone(score: number | null): KpiTone {
  return score !== null && score < HEALTH_DANGER_SCORE ? "danger" : "default";
}

function riskHelper(count: number): string {
  if (count === 0) return "No open risks";
  return count === 1 ? "1 open risk" : `${count} open risks`;
}

function lookAheadHelper(upcoming: number, uncovered: number): string | undefined {
  if (upcoming === 0) return undefined;
  return uncovered > 0 ? `${uncovered} without materials ordered` : "All materials ordered";
}

/**
 * The six insight tiles (Ernest's PercentageCards): 3-up, 6-up on very wide
 * screens. Every figure comes from data the page already loads.
 */
export function OverviewKpis({ project, risks, autoWindow, snapshot }: OverviewKpisProps) {
  const upcomingCount = autoWindow?.activities.length ?? 0;
  const uncoveredCount = autoWindow?.activities.filter((a) => !a.hasMaterialCoverage).length ?? 0;
  const healthScore = snapshot?.health.score ?? null;

  return (
    <section aria-label="Project insights" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <div data-tour="construction-progress" className="flex">
        <KpiCard className="flex-1" label="Construction progress" progress={project.progressPercent} />
      </div>
      <div data-tour="construction-budget" className="flex">
        <KpiCard
          className="flex-1"
          label="Budget used"
          value={formatCurrency(project.budgetUsed, project.currency)}
          helper={`of ${formatCurrency(project.budgetTotal, project.currency)}`}
          tone={budgetTone(project.budgetUsed, project.budgetTotal)}
        />
      </div>
      <div data-tour="construction-approvals" className="flex">
        <KpiCard
          className="flex-1"
          label="Pending approvals"
          value={project.pendingApprovals}
          helper={project.pendingApprovals > 0 ? "Awaiting your review" : "Nothing pending"}
        />
      </div>
      <KpiCard
        label="Upcoming look-aheads"
        value={upcomingCount > 0 ? upcomingCount : "None"}
        helper={lookAheadHelper(upcomingCount, uncoveredCount)}
        tone={uncoveredCount > 0 ? "danger" : "default"}
      />
      <KpiCard
        label="Risk level"
        value={project.risk}
        helper={riskHelper(risks.length)}
        tone={riskTone(project.risk)}
      />
      <KpiCard
        label="Health score"
        value={healthScore ?? EMPTY_VALUE}
        helper={healthScore === null ? "Awaiting analysis" : "out of 100"}
        tone={healthTone(healthScore)}
      />
    </section>
  );
}

OverviewKpis.displayName = "OverviewKpis";
