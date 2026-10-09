import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { FormDialog } from "@/components/molecules/form-dialog";
import type { ApplyPins, ApplyPreview, ApplyPreviewItem } from "@/api/precon";
import { useApplyTakeoffToEstimate, getApplyConflictDetails } from "@/hooks/use-precon";
import { useCreateEstimate, useProposalWorkspace } from "@/hooks/use-proposals";
import { useAbility } from "@/contexts/ability-context";
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
        {item.reviewStatus && item.reviewStatus !== "verified" ? <Badge tone="warning">unverified</Badge> : null}
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </span>
    </li>
  );
}
PreviewRow.displayName = "PreviewRow";

/** The four pins the server demands, read off the stored preview — or null while the preview lacks them. */
function pinsOf(preview: ApplyPreview | null): ApplyPins | null {
  if (!preview?.source || !preview.target || !preview.review) return null;
  return {
    sourceFingerprint: preview.source.fingerprint,
    targetFingerprint: preview.target.fingerprint,
    expectedRows: preview.source.expectedRows,
    acknowledgedUnverifiedRowIds: preview.review.unverifiedRowIds,
  };
}

/**
 * Nothing reaches the estimate except THIS previewed state: apply echoes the
 * preview's fingerprints, row versions and unverified acknowledgement back as
 * pins, and any drift is a 409 that wrote nothing. There is no auto-apply.
 * An estimate is a data record — applying writes draft lines; no money moves.
 */
export function PreconApplyDialog({ open, onOpenChange, sessionId, proposalId }: Props) {
  const navigate = useNavigate();
  const canApply = useAbility().can("apply", "takeoffs");
  const { data: workspace, isPending: workspacePending } = useProposalWorkspace(proposalId);
  const createEstimate = useCreateEstimate(proposalId);
  const apply = useApplyTakeoffToEstimate(sessionId, proposalId);
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  /** Set from a refused apply's 409 details; cleared only by a DELIBERATE re-preview. */
  const [staleReasons, setStaleReasons] = useState<string[] | null>(null);

  const estimate = workspace?.estimate ?? null;
  const editable = estimate?.status === "Draft";

  const runPreview = (estimateId: string) => {
    setPreview(null);
    setError(null);
    setAcknowledged(false);
    setStaleReasons(null);
    apply.mutate(
      { estimateId, mode: "preview" },
      {
        onSuccess: setPreview,
        onError: (err) => setError(getApiErrorMessage(err, "Could not preview the changes.")),
      },
    );
  };

  useEffect(() => {
    if (!open || !estimate || !editable || !canApply) return;
    runPreview(estimate.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, estimate?.id, editable, canApply]);

  const unverifiedIds = preview?.review?.unverifiedRowIds ?? [];
  const unverifiedItems = (preview?.items ?? []).filter((i) => i.boqItemId && unverifiedIds.includes(i.boqItemId));
  const pins = pinsOf(preview);
  const needsAck = unverifiedIds.length > 0;

  function submit() {
    if (!estimate || !pins || staleReasons) return;
    apply.mutate(
      { estimateId: estimate.id, mode: "apply", pins },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          toast(`${result.written ?? result.items.length} line${(result.written ?? result.items.length) === 1 ? "" : "s"} recorded on the draft estimate.`, "success");
          navigate(`/sales/proposals/${proposalId}?tab=estimate`);
        },
        onError: (err) => {
          const conflict = getApplyConflictDetails(err);
          if (conflict) {
            // the preview is dead: show every reason and demand a fresh
            // preview + fresh acknowledgement — never a silent resubmit
            setStaleReasons(conflict.reasons);
            setAcknowledged(false);
            setError(null);
            return;
          }
          setError(getApiErrorMessage(err, "Could not apply to the estimate. Nothing was written."));
        },
      },
    );
  }

  const visible = preview?.items.filter((i) => i.change !== "unchanged") ?? [];
  const summary = preview ? `${preview.added} added · ${preview.changed} changed · ${preview.removed} removed · ${preview.unchanged} unchanged` : null;
  const review = preview?.review ?? null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bring this take-off into the estimate"
      description="An estimate is a record — applying writes draft lines onto it; no money moves. Rates already entered on the estimate are kept; hand-entered items are untouched."
      submitLabel={preview ? `Apply ${preview.added + preview.changed + preview.removed} changes` : "Apply"}
      submitting={apply.isPending && preview !== null}
      submitDisabled={!canApply || !preview || !pins || !editable || staleReasons !== null || (needsAck && !acknowledged) || preview.added + preview.changed + preview.removed === 0}
      error={error}
      onSubmit={submit}
      className="w-[min(640px,calc(100vw-2rem))]"
    >
      {!canApply ? (
        <p className="text-sm text-gray-600" data-no-apply-permission>
          You can view this take-off, but recording it on an estimate needs the take-off apply permission. Ask an owner or estimator.
        </p>
      ) : workspacePending ? (
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
        <p className="text-sm text-gray-600" data-estimate-locked>
          {estimate.revisionLabel} is {estimate.status.toLowerCase()} and refuses every write. Create a new revision on the Estimate tab first.
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
          {review ? (
            <p className="text-xs text-gray-500" data-review-summary>
              Review: {review.verified} verified · {review.needsReview} needing review · {review.aiGenerated} AI-drafted
            </p>
          ) : null}
          {staleReasons ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2" data-stale-reasons>
              <p className="text-xs font-semibold text-amber-800">This preview is out of date — nothing was written.</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-amber-800">
                {staleReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <Button size="sm" variant="secondary" className="mt-2" loading={apply.isPending} onClick={() => runPreview(estimate.id)}>
                Refresh the preview
              </Button>
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">The estimate already matches this take-off.</p>
          ) : (
            <ul className="max-h-60 divide-y divide-line-hair overflow-y-auto rounded-lg border border-line px-3">
              {visible.map((item) => (
                <PreviewRow key={`${item.boqItemId ?? item.description}-${item.change}`} item={item} />
              ))}
            </ul>
          )}
          {needsAck && !staleReasons ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
              <p className="text-xs text-amber-800">
                {unverifiedIds.length} line{unverifiedIds.length === 1 ? " has" : "s have"} not been verified
                {unverifiedItems.length > 0 ? `: ${unverifiedItems.map((i) => i.description).slice(0, 4).join(", ")}${unverifiedItems.length > 4 ? "…" : ""}` : ""}.
                Verify them on the Review step first, or acknowledge that they flow to the estimate as drafted.
              </p>
              <label className="mt-1.5 flex items-start gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  data-ack-unverified
                  className="mt-0.5"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                I acknowledge these {unverifiedIds.length} unverified line{unverifiedIds.length === 1 ? "" : "s"} will be recorded as they stand.
              </label>
            </div>
          ) : null}
        </div>
      )}
    </FormDialog>
  );
}
PreconApplyDialog.displayName = "PreconApplyDialog";
