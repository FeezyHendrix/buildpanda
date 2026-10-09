import { FileText, Image as ImageIcon, PencilRuler } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import type { ProposalPlan } from "@/api/proposals";
import type { PreconSession } from "@/api/precon";
import { filesApi } from "@/api/files";
import { formatShortDate } from "@/lib/formatters";
import { HAND_MEASURABLE_PLAN, MEASURABLE_PLAN, PDF_PLAN, PLAN_DISCIPLINE_LABEL, describeScope } from "@/lib/precon-meta";

interface Props {
  plan: ProposalPlan;
  /** Take-offs measured on this exact revision. */
  sessions: PreconSession[];
  /** A take-off exists on a revision this plan supersedes: it needs re-measuring. */
  staleSessions: PreconSession[];
  /** Opens the measure dialog, where who measures and what is chosen. */
  onMeasure: (plan: ProposalPlan) => void;
  onDetails: (plan: ProposalPlan) => void;
  onNewRevision: (plan: ProposalPlan) => void;
  onRemove: (plan: ProposalPlan) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function PlanIcon({ fileName }: { fileName: string }) {
  const Icon = PDF_PLAN.test(fileName) ? FileText : MEASURABLE_PLAN.test(fileName) ? PencilRuler : ImageIcon;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
PlanIcon.displayName = "PlanIcon";

// Every revision is kept for the audit trail, but the drawing shows one badge
// per scope and kind: the current revision, linked. A hand-drawn take-off has
// its own lineage beside the Panda AI one on the same drawing.
function currentPerScope(sessions: PreconSession[]): PreconSession[] {
  const byScope = new Map<string, PreconSession>();
  for (const s of sessions) {
    if (s.supersededBy !== null) continue;
    const key = `${s.takeoffKind === "manual" ? "manual" : "ai"}:${describeScope(s.scope)}`;
    const held = byScope.get(key);
    if (!held || s.revision > held.revision) byScope.set(key, s);
  }
  return [...byScope.values()];
}

function MeasuredBadges({ sessions, staleSessions }: { sessions: PreconSession[]; staleSessions: PreconSession[] }) {
  if (sessions.length === 0 && staleSessions.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {currentPerScope(sessions).map((s) => (
        <Link key={s.id} to={`/sales/takeoff/${s.id}`} className="rounded-full focus:outline-none focus:shadow-focus" title="Open the take-off">
          <Badge tone={s.status === "failed" ? "danger" : "success"}>
            {s.takeoffKind === "manual" ? "By hand" : "Panda AI"} · {describeScope(s.scope)}
            {s.revision > 1 ? ` · Rev ${s.revision}` : ""}
          </Badge>
        </Link>
      ))}
      {staleSessions.length > 0 ? <Badge tone="warning">Measured on an earlier revision</Badge> : null}
    </span>
  );
}
MeasuredBadges.displayName = "MeasuredBadges";

export function PlanRow({ plan, sessions, staleSessions, onMeasure, onDetails, onNewRevision, onRemove }: Props) {
  const measurable = HAND_MEASURABLE_PLAN.test(plan.fileName);
  const meta = [
    plan.sheetCode,
    plan.discipline ? PLAN_DISCIPLINE_LABEL[plan.discipline] : null,
    plan.revision ? `Rev ${plan.revision}` : null,
  ].filter(Boolean);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <PlanIcon fileName={plan.fileName} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={filesApi.downloadUrl(plan.fileId)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-medium text-gray-900 hover:underline"
            >
              {plan.fileName}
            </a>
            {meta.length > 0 ? <span className="font-mono text-xs text-gray-500">{meta.join(" · ")}</span> : null}
            <MeasuredBadges sessions={sessions} staleSessions={staleSessions} />
          </div>
          <p className="text-xs text-gray-400">
            {formatBytes(plan.sizeBytes)} · {formatShortDate(plan.uploadedAt)}
            {plan.supersedesPlanId ? " · supersedes an earlier revision" : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {measurable ? (
          <Button size="sm" variant="secondary" onClick={() => onMeasure(plan)}>
            <PencilRuler className="mr-1.5 size-3.5" aria-hidden="true" />
            Measure
          </Button>
        ) : null}
        <RowActionsMenu
          ariaLabel={`Actions for ${plan.fileName}`}
          items={[
            { label: "Upload new revision", onSelect: () => onNewRevision(plan) },
            { label: "Edit details", onSelect: () => onDetails(plan) },
            { label: "Remove", onSelect: () => onRemove(plan), tone: "danger" },
          ]}
        />
      </div>
    </li>
  );
}
PlanRow.displayName = "PlanRow";
