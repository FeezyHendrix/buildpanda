import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "./form-dialog";
import type { ApprovalStatus } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

/** Only the three lifecycle moves a reviewer can record; "Pending" is not a decision. */
export type MaterialDecision = Extract<ApprovalStatus, "Approved" | "Rejected" | "Resubmit">;

interface DecisionCopy {
  title: string;
  description: string;
  submitLabel: string;
  placeholder: string;
}

export const MATERIAL_DECISION_COPY: Record<MaterialDecision, DecisionCopy> = {
  Approved: {
    title: "Approve material",
    description: "Records your sign-off against this material and specification.",
    submitLabel: "Approve",
    placeholder: "Any conditions attached to the approval (optional)",
  },
  Rejected: {
    title: "Reject material",
    description: "Records a rejection. The requester will need to raise a new request.",
    submitLabel: "Reject",
    placeholder: "Why this material is not acceptable (optional)",
  },
  Resubmit: {
    title: "Request resubmission",
    description: "Sends the request back for amendment without rejecting it outright.",
    submitLabel: "Request changes",
    placeholder: "What needs to change before resubmission (optional)",
  },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: MaterialDecision;
  materialName: string;
  onSubmit: (response: string | null) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function MaterialApprovalDecisionDialog({
  open,
  onOpenChange,
  decision,
  materialName,
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [response, setResponse] = useState("");
  const copy = MATERIAL_DECISION_COPY[decision];

  useEffect(() => {
    if (open) setResponse("");
  }, [open, decision]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      submitLabel={copy.submitLabel}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={() => onSubmit(response.trim() || null)}
    >
      <p className="text-sm text-gray-500">
        Material: <span className="font-medium text-gray-900">{materialName}</span>
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-decision-response">Response</Label>
        <textarea
          id="ma-decision-response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={4}
          placeholder={copy.placeholder}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
        <p className="text-xs text-gray-400">
          Recorded against the request with your name and the time of the decision.
        </p>
      </div>
    </FormDialog>
  );
}

MaterialApprovalDecisionDialog.displayName = "MaterialApprovalDecisionDialog";

export { MaterialApprovalDecisionDialog };
