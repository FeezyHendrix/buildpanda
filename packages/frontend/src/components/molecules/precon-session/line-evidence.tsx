import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import type { PreconBoqRow } from "@/api/precon";
import { confidenceReasonParts } from "@/lib/precon-meta";
import { cn } from "@/lib/utils";

// The engine writes provenance as "<where>: <basis>". Show the where on its
// own line and the basis under it, so nothing is printed twice.
function splitProvenance(row: PreconBoqRow): { source: string | null; basis: string | null } {
  const basis = row.measurementBasis?.trim() ?? null;
  const provenance = row.provenance?.trim() ?? null;
  if (!provenance) return { source: null, basis };
  if (basis && provenance.endsWith(basis)) {
    return { source: provenance.slice(0, provenance.length - basis.length).replace(/:\s*$/, ""), basis };
  }
  const colon = provenance.indexOf(": ");
  if (colon > 0 && !basis) return { source: provenance.slice(0, colon), basis: provenance.slice(colon + 2) };
  return { source: provenance, basis: basis && basis !== provenance ? basis : null };
}

// A basis sentence often carries a second sentence with the sheet summary;
// each sentence reads better on its own line.
function sentences(text: string): string[] {
  return text
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

type CheckTone = "agree" | "warn" | "note";

function toneOf(check: string): CheckTone {
  if (/disagree|differ|not measured|inconclusive|assumed|no parallel|not enclosed/i.test(check)) return "warn";
  if (/agree|confirm|every wall line found|methods agree/i.test(check)) return "agree";
  return "note";
}

const CHECK_ICON: Record<CheckTone, { Icon: typeof CheckCircle2; className: string }> = {
  agree: { Icon: CheckCircle2, className: "text-success-500" },
  warn: { Icon: CircleAlert, className: "text-warning-400" },
  note: { Icon: CircleDashed, className: "text-black-300" },
};

function CheckLine({ check }: { check: string }) {
  const { Icon, className } = CHECK_ICON[toneOf(check)];
  return (
    <li className="flex items-start gap-1.5">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", className)} aria-hidden="true" />
      <span>{check}</span>
    </li>
  );
}
CheckLine.displayName = "CheckLine";

/**
 * Where a bill line came from and what the engine checked it against:
 * source, the measurement basis sentence by sentence, then each check as its
 * own line with an agree / warn / note mark.
 */
export function LineEvidence({ row }: { row: PreconBoqRow }) {
  const { source, basis } = splitProvenance(row);
  const checks = confidenceReasonParts(row.confidenceReason);
  if (!source && !basis && checks.length === 0) return null;
  return (
    <div className="space-y-2 text-xs">
      {source ? <p className="text-ink-subtle">{source}</p> : null}
      {basis ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-black-300">Basis</p>
          {sentences(basis).map((s) => (
            <p key={s} className="mt-0.5 text-ink-muted">
              {s}
            </p>
          ))}
        </div>
      ) : null}
      {checks.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-black-300">Checks</p>
          <ul className="mt-0.5 space-y-0.5 text-ink-muted">
            {checks.map((c) => (
              <CheckLine key={c} check={c} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
LineEvidence.displayName = "LineEvidence";
