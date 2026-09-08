import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { MeasurePlanDialog, type MeasurablePlan } from "@/components/molecules/proposal-plans/measure-plan-dialog";
import { PlanRow } from "@/components/molecules/proposal-plans/plan-row";
import { PlanUploadCard, type UploadItem } from "@/components/molecules/proposal-plans/plan-upload-card";
import { TakeoffList } from "@/components/molecules/proposal-plans/takeoff-list";
import type { ProposalPlan } from "@/api/proposals";
import type { TakeoffScope } from "@/api/precon";
import { useUploadFile } from "@/hooks/use-files";
import {
  useCreateBlankPreconSession,
  useCreatePreconSessionFromPlan,
  usePreconSessions,
} from "@/hooks/use-precon";
import {
  useAddPlan,
  useDeletePlan,
  useProposalPlans,
  useProposalTakeoffs,
  useProposalWorkspace,
  useStartProposalTakeoff,
} from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { MEASURABLE_PLAN, PDF_PLAN } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";

interface Props {
  proposalId: string;
}

let uploadSeq = 0;

export function PlansTab({ proposalId }: Props) {
  const navigate = useNavigate();
  const { data: plans = [], isPending: plansPending } = useProposalPlans(proposalId);
  const { data: jobs = [] } = useProposalTakeoffs(proposalId);
  const { data: sessions = [] } = usePreconSessions(proposalId);
  const { data: workspace } = useProposalWorkspace(proposalId);
  const jobProfile = workspace?.proposal.jobProfile ?? null;
  const uploadFile = useUploadFile();
  const addPlan = useAddPlan(proposalId);
  const deletePlan = useDeletePlan(proposalId);
  const measurePlan = useCreatePreconSessionFromPlan(proposalId);
  const startDwgTakeoff = useStartProposalTakeoff(proposalId);
  const createBlank = useCreateBlankPreconSession();

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [measureTargets, setMeasureTargets] = useState<MeasurablePlan[]>([]);
  const [measureError, setMeasureError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProposalPlan | null>(null);

  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  // Each file uploads with its own progress row; the ones Panda AI can measure
  // are offered in a single dialog once the batch lands, so a ten-sheet drop
  // asks once, not ten times.
  async function handleFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    const added: MeasurablePlan[] = [];
    await Promise.all(
      files.map(async (file) => {
        const id = `u${++uploadSeq}`;
        setUploads((prev) => [...prev, { id, name: file.name, percent: 0, state: "uploading" }]);
        try {
          const uploaded = await uploadFile.mutateAsync({
            file,
            onProgress: (percent) => patchUpload(id, { percent }),
          });
          const next = await addPlan.mutateAsync({ fileId: uploaded.id });
          const plan = next.find((p) => p.fileId === uploaded.id);
          patchUpload(id, { state: "done", percent: 100 });
          if (plan && MEASURABLE_PLAN.test(plan.fileName)) added.push({ id: plan.id, fileName: plan.fileName });
        } catch (err) {
          patchUpload(id, { state: "error", error: getApiErrorMessage(err, "Upload failed. Try again.") });
        }
      }),
    );
    setUploads((prev) => prev.filter((u) => u.state !== "done"));
    if (added.length > 0) {
      setMeasureError(null);
      setMeasureTargets(added);
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
      toast(`Panda AI is measuring ${count} drawing${count === 1 ? "" : "s"}. Progress shows below.`, "success");
    } catch (err) {
      setMeasureError(getApiErrorMessage(err, "Could not start the take-off."));
    }
  }

  function createBlankSheet() {
    createBlank.mutate(
      { title: "Untitled pricing sheet", proposalId },
      {
        onSuccess: (session) => navigate(`/sales/takeoff/${session.id}`),
        onError: (err) => toast(getApiErrorMessage(err, "Could not start the pricing sheet."), "error"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PlanUploadCard uploads={uploads} onFiles={(files) => void handleFiles(files)} />

      {plansPending ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans uploaded"
          description="Drop the first drawing above. Files are private to your team and the client receiving this proposal."
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              onMeasure={(p) => {
                setMeasureError(null);
                setMeasureTargets([{ id: p.id, fileName: p.fileName }]);
              }}
              onRemove={setRemoveTarget}
            />
          ))}
        </ul>
      )}

      <TakeoffList
        proposalId={proposalId}
        sessions={sessions}
        jobs={jobs}
        onCreateBlank={createBlankSheet}
        creatingBlank={createBlank.isPending}
      />

      <MeasurePlanDialog
        open={measureTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setMeasureTargets([]);
        }}
        plans={measureTargets}
        submitting={measurePlan.isPending || startDwgTakeoff.isPending}
        error={measureError}
        onConfirm={(scope) => void startMeasuring(scope)}
        jobProfile={jobProfile}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        variant="danger"
        title="Remove this plan?"
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
            onError: (err) => toast(getApiErrorMessage(err, "Could not remove the plan."), "error"),
          });
        }}
      />
    </div>
  );
}
PlansTab.displayName = "PlansTab";
