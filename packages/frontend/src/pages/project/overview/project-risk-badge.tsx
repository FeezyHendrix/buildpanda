import { Badge } from "@/components/atoms/badge";
import { useProjectRiskFactors } from "@/hooks/use-risks";
import { RISK_SEVERITY_META } from "@/lib/risk-meta";
import type { RiskFactor, RiskLevel } from "@/lib/project-types";

/**
 * The project's risk level, read off the register rather than off a field.
 *
 * A risk badge is a claim about exposure, so it has to answer to the risks a
 * PM can actually point at: it is the worst severity still open. A mitigated,
 * closed or already-occurred risk is no longer exposure — the first has a
 * response in place, the last two cannot hurt the job any more — so only `open`
 * rows count, which is the same set the register's "Open high risks" KPI
 * measures. No open risks at all reads "No open risks", never a cheerful "Low".
 */

const SEVERITY_RANK: Record<RiskLevel, number> = { Low: 1, Medium: 2, High: 3 };

export function highestOpenSeverity(risks: RiskFactor[]): RiskLevel | null {
  let worst: RiskLevel | null = null;
  for (const risk of risks) {
    if (risk.status !== "open") continue;
    if (!worst || SEVERITY_RANK[risk.severity] > SEVERITY_RANK[worst]) worst = risk.severity;
  }
  return worst;
}

export function ProjectRiskBadge({ projectId }: { projectId: string }) {
  const { data: risks = [], isPending } = useProjectRiskFactors(projectId);
  const severity = highestOpenSeverity(risks);

  if (isPending) return null;

  if (!severity) {
    return (
      <Badge size="md" tone="success" title="Nothing open on the risk register">
        No open risks
      </Badge>
    );
  }

  const meta = RISK_SEVERITY_META[severity];
  const openAtSeverity = risks.filter((r) => r.status === "open" && r.severity === severity).length;

  return (
    <Badge
      size="md"
      tone={meta.tone}
      title={`${openAtSeverity} open ${meta.label.toLowerCase()} risk${openAtSeverity === 1 ? "" : "s"} on the register`}
    >
      <span aria-hidden>{meta.shape}</span>
      {meta.label} risk
    </Badge>
  );
}

ProjectRiskBadge.displayName = "ProjectRiskBadge";
