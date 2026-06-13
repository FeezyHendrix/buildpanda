import { useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { useAddPlan, useDeletePlan, useProposalPlans } from "@/hooks/use-proposals";
import api from "@/api/client";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";

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
  const { data: plans = [], isLoading } = useProposalPlans(proposalId);
  const addPlan = useAddPlan(proposalId);
  const deletePlan = useDeletePlan(proposalId);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // `undefined` lets the browser set multipart/form-data WITH a boundary;
      // a hardcoded value omits it and the upload fails server-side.
      const { data: uploaded } = await api.post<{ id: string }>("/files", form, {
        headers: { "Content-Type": undefined },
      });
      await addPlan.mutateAsync({ fileId: uploaded.id });
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
          artwork for this proposal. PDFs and images supported.
        </p>
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-[#004DE7] px-4 py-2 text-sm font-medium text-white hover:bg-[#003fb8]">
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
          {uploading ? "Uploading…" : "Choose file"}
        </label>
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
            const downloadUrl = `${api.defaults.baseURL ?? ""}/files/${plan.fileId}/download`;
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
                <button
                  type="button"
                  onClick={() => handleDelete(plan.id)}
                  className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                  disabled={deletePlan.isPending}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
