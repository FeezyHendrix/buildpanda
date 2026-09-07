import { FileText, Image as ImageIcon, PencilRuler, Sparkles } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { ProposalPlan } from "@/api/proposals";
import { filesApi } from "@/api/files";
import { formatShortDate } from "@/lib/formatters";
import { MEASURABLE_PLAN, PDF_PLAN } from "@/lib/precon-meta";

interface Props {
  plan: ProposalPlan;
  onMeasure: (plan: ProposalPlan) => void;
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

export function PlanRow({ plan, onMeasure, onRemove }: Props) {
  const measurable = MEASURABLE_PLAN.test(plan.fileName);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <PlanIcon fileName={plan.fileName} />
        <div className="min-w-0">
          <a
            href={filesApi.downloadUrl(plan.fileId)}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-gray-900 hover:underline"
          >
            {plan.fileName}
          </a>
          <p className="text-xs text-gray-400">
            {formatBytes(plan.sizeBytes)} · {formatShortDate(plan.uploadedAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {measurable ? (
          <Button size="sm" variant="secondary" className="text-primary-700" onClick={() => onMeasure(plan)}>
            <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
            Measure with Panda AI
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => onRemove(plan)}>
          Remove
        </Button>
      </div>
    </li>
  );
}
PlanRow.displayName = "PlanRow";
