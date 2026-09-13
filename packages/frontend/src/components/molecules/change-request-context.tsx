import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { CHANGE_TYPE_LABELS } from "@/components/molecules/upsert-change-request-dialog";
import { formatShortDate, formatWholeCurrency } from "@/lib/formatters";
import type { ChangeRequestDetail, ChangeType } from "@/lib/project-types";

/**
 * What a change hangs off, and how it got to where it is.
 *
 * The links matter contractually: a change hung on a stage moves that stage's
 * dates when it is executed, one raised off an RFI is the answer to that query,
 * and an EOT-only claim carries its days through the extension-of-time record
 * rather than as a number that goes nowhere. The revision list is the
 * negotiation — "v1 ₦4.8m rejected → v2 ₦4.2m approved" — which a list showing
 * only the latest figure erases.
 */

const TYPE_TONE: Record<ChangeType, "info" | "neutral" | "accent" | "warning"> = {
  variation: "info",
  omission: "neutral",
  eot_only: "accent",
  provisional_sum: "warning",
};

export function ChangeTypeBadge({ type }: { type: ChangeType }) {
  return (
    <Badge tone={TYPE_TONE[type]} size="sm" dot>
      {CHANGE_TYPE_LABELS[type].label}
    </Badge>
  );
}

ChangeTypeBadge.displayName = "ChangeTypeBadge";

export function ChangeRequestLinks({ projectId, cr }: { projectId: string; cr: ChangeRequestDetail }) {
  const links: { label: string; to: string }[] = [];
  if (cr.stageId) links.push({ label: "Affected stage", to: `/project/${projectId}/stages` });
  if (cr.rfiId) links.push({ label: "Originating RFI", to: `/project/${projectId}/rfis` });
  if (cr.eotClaimId) {
    links.push({ label: "Extension of time claim", to: `/project/${projectId}/extensions-of-time` });
  }
  if (cr.contractId) {
    links.push({ label: "Change order contract", to: `/project/${projectId}/finances/contracts-phases` });
  }
  if (links.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-medium uppercase text-ink-muted">Linked records</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="inline-flex items-center rounded-md bg-surface-alt px-2.5 py-1 text-xs font-medium text-primary-600 hover:underline"
            >
              {link.label} ›
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

ChangeRequestLinks.displayName = "ChangeRequestLinks";

export function ChangeRequestRevisions({ cr }: { cr: ChangeRequestDetail }) {
  const revisions = cr.revisions ?? [];
  if (revisions.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-medium uppercase text-ink-muted">Revisions ({revisions.length})</p>
      <ol className="mt-2 flex flex-col gap-2">
        {revisions.map((revision) => (
          <li key={revision.version} className="rounded-lg bg-surface-alt p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                v{revision.version} · {formatWholeCurrency(revision.costImpact, cr.currency)}
                {revision.timeImpactDays > 0 ? ` · +${revision.timeImpactDays} days` : ""}
              </span>
              <span className="text-xs text-ink-muted">
                {revision.status} · {formatShortDate(revision.at) || revision.at}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">by {revision.actorName}</p>
            {revision.reason ? (
              <p className="mt-1 text-sm leading-6 text-gray-700">{revision.reason}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

ChangeRequestRevisions.displayName = "ChangeRequestRevisions";
