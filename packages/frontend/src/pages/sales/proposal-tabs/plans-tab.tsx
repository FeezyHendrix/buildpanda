import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  useAddPlan,
  useDeletePlan,
  useProposalPlans,
  useProposalTakeoffs,
  useStartProposalTakeoff,
} from "@/hooks/use-proposals";
import { useUploadFile } from "@/hooks/use-files";
import { useCreatePreconSessionFromPlan, usePreconSessions } from "@/hooks/use-precon";
import { useNavigate } from "react-router-dom";
import { filesApi } from "@/api/files";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import { proposalKeys } from "@/hooks/query-keys";

interface Props {
  proposalId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function PlansTab({ proposalId }: Props) {
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = useProposalPlans(proposalId);
  const { data: takeoffs = [] } = useProposalTakeoffs(proposalId);
  const addPlan = useAddPlan(proposalId);
  const deletePlan = useDeletePlan(proposalId);
  const startTakeoff = useStartProposalTakeoff(proposalId);
  const uploadFile = useUploadFile();
  const navigate = useNavigate();
  const { data: takeoffSessions = [] } = usePreconSessions(proposalId);
  const measurePlan = useCreatePreconSessionFromPlan(proposalId);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptPlan, setPromptPlan] = useState<{ id: string; fileName: string } | null>(null);

  useEffect(() => {
    if (takeoffs.some((job) => job.status === "completed")) {
      void qc.invalidateQueries({ queryKey: proposalKeys.boq(proposalId) });
    }
  }, [proposalId, qc, takeoffs]);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadFile.mutateAsync({ file });
      const nextPlans = await addPlan.mutateAsync({ fileId: uploaded.id });
      const added = nextPlans.find((plan) => plan.fileId === uploaded.id) ?? nextPlans[nextPlans.length - 1];
      if (added && /\.(dwg|pdf)$/i.test(added.fileName)) {
        setPromptPlan({ id: added.id, fileName: added.fileName });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to upload. Try again."));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(planId: string) {
    await deletePlan.mutateAsync(planId);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6">
        <p className="text-sm text-gray-600">
          Upload architectural drawings, site plans, MEP schematics, or any reference
          artwork for this proposal. Panda AI can measure PDF and DWG drawings into a draft BoQ for review.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".dwg,.pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
        <Button className="w-fit" loading={uploading} onClick={() => fileInputRef.current?.click()}>
          Choose file
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans uploaded"
          description="Add the first drawing above. Files are private to your team and the client receiving this proposal."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
          {plans.map((plan) => {
            const downloadUrl = filesApi.downloadUrl(plan.fileId);
            return (
              <li key={plan.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    📄
                  </span>
                  <div>
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      {plan.fileName}
                    </a>
                    <p className="text-xs text-gray-400">
                      {formatBytes(plan.sizeBytes)} · {formatShortDate(plan.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/\.pdf$/i.test(plan.fileName) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-primary-700"
                      loading={measurePlan.isPending}
                      onClick={() => {
                        void measurePlan
                          .mutateAsync(plan.id)
                          .then((session) => navigate(`/sales/takeoff/${session.id}`))
                          .catch((err) => setError(getApiErrorMessage(err, "Could not start the takeoff.")));
                      }}
                    >
                      ✦ Measure with Panda AI
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:bg-red-50"
                    disabled={deletePlan.isPending}
                    onClick={() => void handleDelete(plan.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {promptPlan && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-950">Measure this drawing with Panda AI?</p>
              <p className="mt-1 text-sm text-blue-800">
                Panda AI can measure <strong>{promptPlan.fileName}</strong> into a draft BoQ. You review and verify
                every line before it touches this proposal.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-blue-800" onClick={() => setPromptPlan(null)}>
                Not now
              </Button>
              <Button
                size="sm"
                loading={startTakeoff.isPending || measurePlan.isPending}
                onClick={() => {
                  if (/\.pdf$/i.test(promptPlan.fileName)) {
                    void measurePlan
                      .mutateAsync(promptPlan.id)
                      .then((session) => {
                        setPromptPlan(null);
                        navigate(`/sales/takeoff/${session.id}`);
                      })
                      .catch((err) => setError(getApiErrorMessage(err, "Could not start the takeoff.")));
                  } else {
                    void startTakeoff.mutateAsync(promptPlan.id).then(() => setPromptPlan(null));
                  }
                }}
              >
                Measure with Panda AI
              </Button>
            </div>
          </div>
        </div>
      )}

      {takeoffSessions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Panda AI takeoffs</p>
          <ul className="mt-3 space-y-2 text-sm">
            {takeoffSessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                <span className="truncate text-gray-700">{session.title}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">{session.status}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary-700"
                    onClick={() => navigate(`/sales/takeoff/${session.id}`)}
                  >
                    {session.status === "reviewing" ? "Review" : "Open"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {takeoffs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Automated take-off jobs</p>
          <ul className="mt-3 space-y-2 text-sm">
            {takeoffs.slice(0, 5).map((job) => (
              <li key={job.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="truncate text-gray-700">{job.fileName}</span>
                <span className="text-xs font-medium text-gray-500">
                  {job.status === "completed" ? `${job.elementCount} lines added` : job.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
