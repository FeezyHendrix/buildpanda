import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { PreconSnapshot } from "@/api/precon";
import { PRECON_STATUS_LABEL, PRECON_STATUS_TONE, describeScope, formatStructureContext } from "@/lib/precon-meta";
import type { PreconStepKey } from "./precon-stepper";
import { cn } from "@/lib/utils";

interface Props {
  snapshot: PreconSnapshot;
  step: PreconStepKey;
  reviewing: boolean;
  onSelectStep: (step: PreconStepKey) => void;
}

export function PreconSessionHeader({ snapshot, step, reviewing, onSelectStep }: Props) {
  const { session, progress } = snapshot;
  const ctx = session.structureContext;
  const ctxLabel = formatStructureContext(ctx);
  const backTo = session.proposalId ? `/sales/proposals/${session.proposalId}?tab=plans` : "/sales/proposals";
  const running = session.status === "generating" || session.status === "uploading";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Link to={backTo} className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to proposal
        </Link>
        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold text-gray-900">{session.title}</h1>
          <Badge tone={PRECON_STATUS_TONE[session.status]} dot={running}>
            {PRECON_STATUS_LABEL[session.status]}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          {describeScope(session.scope)}
          {reviewing ? ` · ${progress.verified} of ${progress.total} lines verified` : null}
          {ctxLabel ? (
            <span className={cn(ctx?.confidence === "low" && "opacity-75")}>
              {" · "}
              {ctxLabel}
              {ctx?.confidence === "low" ? " (low confidence)" : null}
            </span>
          ) : null}
        </p>
      </div>
      {reviewing ? (
        <div className="flex shrink-0 items-center gap-2">
          {step === "review" ? (
            <Button size="sm" onClick={() => onSelectStep("output")}>
              Continue to output
              <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
            </Button>
          ) : step === "output" ? (
            <Button size="sm" variant="secondary" onClick={() => onSelectStep("review")}>
              <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
              Back to review
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
PreconSessionHeader.displayName = "PreconSessionHeader";
