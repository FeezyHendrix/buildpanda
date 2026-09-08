import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { MeasurePlanDialog, type MeasurablePlan } from "@/components/molecules/proposal-plans/measure-plan-dialog";
import { PlanDetailsDialog, type PlanDetailsMode } from "@/components/molecules/proposal-plans/plan-details-dialog";
import { PlanRow } from "@/components/molecules/proposal-plans/plan-row";
import { PlanUploadCard, type UploadItem } from "@/components/molecules/proposal-plans/plan-upload-card";
import type { PlanDiscipline, ProposalPlan, UpdatePlanInput } from "@/api/proposals";
import type { PreconSession, TakeoffScope } from "@/api/precon";
import { useUploadFile } from "@/hooks/use-files";
import { useCreatePreconSessionFromPlan, usePreconSessions } from "@/hooks/use-precon";
import { useAddPlan, useDeletePlan, useProposalPlans, useStartProposalTakeoff, useUpdatePlan } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { MEASURABLE_PLAN, PDF_PLAN } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";

interface Props {
  proposalId: string;
}

let uploadSeq = 0;

// Sessions measured on a revision that this plan supersedes (walking the chain).
function staleSessionsFor(plan: ProposalPlan, plans: ProposalPlan[], sessions: PreconSession[]): PreconSession[] {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const stale: PreconSession[] = [];
  let cursor = plan.supersedesPlanId ? byId.get(plan.supersedesPlanId) : undefined;
  while (cursor) {
    stale.push(...sessions.filter((s) => s.planId === cursor!.id));
    cursor = cursor.supersedesPlanId ? byId.get(cursor.supersedesPlanId) : undefined;
  }
  return stale;
}

export function DrawingsTab({ proposalId }: Props) {
  const navigate = useNavigate();
  const { data: plans = [], isPending: plansPending } = useProposalPlans(proposalId);
  const { data: sessions = [] } = usePreconSessions(proposalId);
  const uploadFile = useUploadFile();
  const addPlan = useAddPlan(proposalId);
  const updatePlan = useUpdatePlan(proposalId);
  const deletePlan = useDeletePlan(proposalId);
  const measurePlan = useCreatePreconSessionFromPlan(proposalId);
  const startDwgTakeoff = useStartProposalTakeoff(proposalId);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [measureTargets, setMeasureTargets] = useState<MeasurablePlan[]>([]);
  const [measureError, setMeasureError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProposalPlan | null>(null);
  const [details, setDetails] = useState<{ plan: ProposalPlan; mode: PlanDetailsMode } | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [showSuperseded, setShowSuperseded] = useState(false);

  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  async function uploadOne(file: File, meta?: { sheetCode: string; revision: string; discipline: PlanDiscipline | null }) {
    const id = `u${++uploadSeq}`;
    setUploads((prev) => [...prev, { id, name: file.name, percent: 0, state: "uploading" }]);
    try {
      const uploaded = await uploadFile.mutateAsync({ file, onProgress: (percent) => patchUpload(id, { percent }) });
      const next = await addPlan.mutateAsync({
        fileId: uploaded.id,
        sheetCode: meta?.sheetCode,
        revision: meta?.revision,
        discipline: meta?.discipline ?? undefined,
      });
      patchUpload(id, { state: "done", percent: 100 });
      return next.find((p) => p.fileId === uploaded.id) ?? null;
    } catch (err) {
      patchUpload(id, { state: "error", error: getApiErrorMessage(err, "Upload failed. Try again.") });
      return null;
    }
  }

  // Each file uploads with its own progress row; the ones Panda AI can measure
  // are offered in one dialog once the batch lands.
  async function handleFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    const added = (await Promise.all(files.map((f) => uploadOne(f)))).filter((p): p is ProposalPlan => p !== null);
    setUploads((prev) => prev.filter((u) => u.state !== "done"));
    const measurable = added.filter((p) => MEASURABLE_PLAN.test(p.fileName)).map((p) => ({ id: p.id, fileName: p.fileName }));
    if (measurable.length > 0) {
      setMeasureError(null);
      setMeasureTargets(measurable);
    }
  }

  async function startMeasuring(scope: TakeoffScope) {
    setMeasureError(null);
    const pdfs = measureTargets.filter((p) => PDF_PLAN.test(p.fileName));
    const dwgs = measureTargets.filter((p) => !PDF_PLAN.test(p.fileName));
    try {
      const started = await Promise.all(pdfs.map((p) => measurePlan.mutateAsync({ planId: p.id, scope })));
      await Promise.all(dwgs.map((p) => startDwgTakeoff.mutateAsync(p.id)));
      setMeasureTargets([]);
      if (started.length === 1 && dwgs.length === 0) {
        navigate(`/sales/takeoff/${started[0]!.id}`);
        return;
      }
      const count = started.length + dwgs.length;
      toast(`Panda AI is measuring ${count} drawing${count === 1 ? "" : "s"}. Progress shows on the Take-offs tab.`, "success");
    } catch (err) {
      setMeasureError(getApiErrorMessage(err, "Could not start the take-off."));
    }
  }

  function saveDetails(planId: string, input: UpdatePlanInput) {
    setDetailsError(null);
    updatePlan.mutate(
      { planId, ...input },
      {
        onSuccess: () => setDetails(null),
        onError: (err) => setDetailsError(getApiErrorMessage(err, "Could not save the drawing details.")),
      },
    );
  }

  async function uploadRevision(plan: ProposalPlan, file: File, meta: { sheetCode: string; revision: string; discipline: PlanDiscipline | null }) {
    setDetailsError(null);
    // An untagged drawing gets its sheet code now so the two revisions link up.
    if (!plan.sheetCode) await updatePlan.mutateAsync({ planId: plan.id, sheetCode: meta.sheetCode });
    const added = await uploadOne(file, meta);
    setUploads((prev) => prev.filter((u) => u.state !== "done"));
    if (!added) {
      setDetailsError("Upload failed. Try again.");
      return;
    }
    setDetails(null);
    toast(`Rev ${meta.revision} uploaded. The previous revision is kept as superseded.`, "success");
    if (MEASURABLE_PLAN.test(added.fileName)) setMeasureTargets([{ id: added.id, fileName: added.fileName }]);
  }

  const current = plans.filter((p) => p.revisionStatus === "current");
  const superseded = plans.filter((p) => p.revisionStatus !== "current");
  const visible = showSuperseded ? plans : current;

  return (
    <div className="flex flex-col gap-4">
      <PlanUploadCard uploads={uploads} onFiles={(files) => void handleFiles(files)} />

      {plansPending ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No drawings uploaded"
          description="Drop the first drawing above. Files are private to your team and the client receiving this proposal."
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {visible.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                sessions={sessions.filter((s) => s.planId === plan.id)}
                staleSessions={plan.revisionStatus === "current" ? staleSessionsFor(plan, plans, sessions) : []}
                onMeasure={(p) => {
                  setMeasureError(null);
                  setMeasureTargets([{ id: p.id, fileName: p.fileName }]);
                }}
                onDetails={(p) => {
                  setDetailsError(null);
                  setDetails({ plan: p, mode: "details" });
                }}
                onNewRevision={(p) => {
                  setDetailsError(null);
                  setDetails({ plan: p, mode: "revision" });
                }}
                onRemove={setRemoveTarget}
              />
            ))}
          </ul>
          {superseded.length > 0 ? (
            <button
              type="button"
              className="w-full border-t border-gray-100 px-4 py-2 text-left text-xs font-medium text-gray-500 hover:bg-gray-50"
              onClick={() => setShowSuperseded((v) => !v)}
            >
              {showSuperseded ? "Hide" : "Show"} {superseded.length} superseded revision{superseded.length === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
      )}

      <MeasurePlanDialog
        open={measureTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setMeasureTargets([]);
        }}
        plans={measureTargets}
        submitting={measurePlan.isPending || startDwgTakeoff.isPending}
        error={measureError}
        onConfirm={(scope) => void startMeasuring(scope)}
      />

      <PlanDetailsDialog
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
        mode={details?.mode ?? "details"}
        plan={details?.plan ?? null}
        submitting={updatePlan.isPending || uploadFile.isPending || addPlan.isPending}
        error={detailsError}
        onSaveDetails={saveDetails}
        onUploadRevision={(plan, file, meta) => void uploadRevision(plan, file, meta)}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        variant="danger"
        title="Remove this drawing?"
        description={
          removeTarget
            ? `${removeTarget.fileName} will be removed from the proposal. Take-offs already measured from it are kept.`
            : undefined
        }
        confirmLabel="Remove"
        loading={deletePlan.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          deletePlan.mutate(removeTarget.id, {
            onSuccess: () => setRemoveTarget(null),
            onError: (err) => toast(getApiErrorMessage(err, "Could not remove the drawing."), "error"),
          });
        }}
      />
    </div>
  );
}
DrawingsTab.displayName = "DrawingsTab";
