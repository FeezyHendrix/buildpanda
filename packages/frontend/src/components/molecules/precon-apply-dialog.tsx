import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { FormDialog } from "@/components/molecules/form-dialog";
import type { ApplyPreview, ApplyPreviewItem } from "@/api/precon";
import { useApplyTakeoffToEstimate } from "@/hooks/use-precon";
import { useCreateEstimate, useProposalWorkspace } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  proposalId: string;
}

const CHANGE_META: Record<ApplyPreviewItem["change"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  added: { label: "added", tone: "success" },
  changed: { label: "changed", tone: "warning" },
  removed: { label: "removed", tone: "danger" },
  unchanged: { label: "unchanged", tone: "neutral" },
};

const qty = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

function PreviewRow({ item }: { item: ApplyPreviewItem }) {
  const meta = CHANGE_META[item.change];
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="min-w-0 truncate text-gray-800">{item.description}</span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-gray-600">
        {item.previous && item.change === "changed" ? (
          <span className="text-gray-400 line-through">
            {qty.format(item.previous.qty)} {item.previous.unit}
          </span>
        ) : null}
        <span>
          {qty.format(item.qty)} {item.unit}
        </span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </span>
    </li>
  );
}
PreviewRow.displayName = "PreviewRow";

// Nothing reaches the estimate without this preview. The counts come from the
// server diff; Apply writes exactly what is shown, through the same service
// the estimate's own editor uses.
export function PreconApplyDialog({ open, onOpenChange, sessionId, proposalId }: Props) {
  const navigate = useNavigate();
  const { data: workspace, isPending: workspacePending } = useProposalWorkspace(proposalId);
  const createEstimate = useCreateEstimate(proposalId);
  const apply = useApplyTakeoffToEstimate(sessionId, proposalId);
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estimate = workspace?.estimate ?? null;
  const editable = estimate?.status === "Draft";

  useEffect(() => {
    if (!open || !estimate || !editable) return;
    setPreview(null);
    setError(null);
    apply.mutate(
      { estimateId: estimate.id, mode: "preview" },
      {
        onSuccess: setPreview,
        onError: (err) => setError(getApiErrorMessage(err, "Could not preview the changes.")),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, estimate?.id, editable]);

  function submit() {
    if (!estimate) return;
    apply.mutate(
      { estimateId: estimate.id, mode: "apply" },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          toast(`${result.written ?? result.items.length} line${(result.written ?? result.items.length) === 1 ? "" : "s"} on the estimate.`, "success");
          navigate(`/sales/proposals/${proposalId}?tab=estimate`);
        },
        onError: (err) => setError(getApiErrorMessage(err, "Could not apply to the estimate.")),
      },
    );
  }

  const visible = preview?.items.filter((i) => i.change !== "unchanged") ?? [];
  const summary = preview ? `${preview.added} added · ${preview.changed} changed · ${preview.removed} removed · ${preview.unchanged} unchanged` : null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bring this take-off into the estimate"
      description="Quantities flow from the verified lines. Rates already entered on the estimate are kept; hand-entered items are untouched."
      submitLabel={preview ? `Apply ${preview.added + preview.changed + preview.removed} changes` : "Apply"}
      submitting={apply.isPending && preview !== null}
      submitDisabled={!preview || !editable || preview.added + preview.changed + preview.removed === 0}
      error={error}
      onSubmit={submit}
      className="w-[min(600px,calc(100vw-2rem))]"
    >
      {workspacePending ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : !estimate ? (
        <div className="flex flex-col items-start gap-3 text-sm text-gray-600">
          <p>This proposal has no estimate yet. Create the first revision to receive these lines.</p>
          <Button size="sm" loading={createEstimate.isPending} onClick={() => createEstimate.mutate({})}>
            Create estimate
          </Button>
        </div>
      ) : !editable ? (
        <p className="text-sm text-gray-600">
          {estimate.revisionLabel} is {estimate.status.toLowerCase()} and cannot be edited. Create a new revision on the Estimate tab first.
        </p>
      ) : !preview ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500">
            {estimate.revisionLabel} · {summary}
          </p>
          {visible.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">The estimate already matches this take-off.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-line-hair overflow-y-auto rounded-lg border border-line px-3">
              {visible.map((item) => (
                <PreviewRow key={`${item.boqItemId ?? item.description}-${item.change}`} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}
    </FormDialog>
  );
}
PreconApplyDialog.displayName = "PreconApplyDialog";
