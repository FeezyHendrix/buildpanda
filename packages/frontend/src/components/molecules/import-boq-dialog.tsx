import { useEffect, useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { FileUpload } from "@/components/atoms/file-upload";
import { Spinner } from "@/components/atoms/spinner";
import {
  useBoqImportJob,
  useBulkCreateMaterials,
  useStartBoqImport,
  type ParsedBoqMaterial,
} from "@/hooks/use-materials-equipment";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol } from "@/lib/currency";
import { UnitInput } from "@/components/atoms/unit-input";

interface ImportBoqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currency: string;
  onImported: (count: number) => void;
}

const CELL = "h-9 w-full rounded-md bg-[#F6F6F6] px-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function groupNumber(value: number): string {
  return value > 0 ? value.toLocaleString("en-US") : "";
}

function parseGrouped(value: string): number {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function ImportBoqDialog({ open, onOpenChange, projectId, currency, onImported }: ImportBoqDialogProps) {
  const symbol = currencySymbol(currency);
  const [jobId, setJobId] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedBoqMaterial[]>([]);
  const [usedAi, setUsedAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startImport = useStartBoqImport();
  const { data: job } = useBoqImportJob(projectId, jobId);
  const bulkCreate = useBulkCreateMaterials();

  useEffect(() => {
    if (!open) {
      setJobId(null);
      setRows([]);
      setUsedAi(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "completed") {
      setRows(job.materials);
      setUsedAi(job.usedAi);
      setJobId(null);
    } else if (job.status === "failed") {
      setError(job.error ?? "We couldn't extract materials from that file.");
      setJobId(null);
    }
  }, [job]);

  function handleFile(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setRows([]);
    startImport.mutate(
      { projectId, file },
      {
        onSuccess: (started) => setJobId(started.id),
        onError: (e) => setError(getApiErrorMessage(e, "Could not upload that file.")),
      },
    );
  }

  function updateRow(index: number, patch: Partial<ParsedBoqMaterial>): void {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number): void {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConfirm(): void {
    if (rows.length === 0) return;
    bulkCreate.mutate(
      { projectId, materials: rows },
      {
        onSuccess: (result) => {
          onImported(result.created);
          onOpenChange(false);
        },
        onError: (e) => setError(getApiErrorMessage(e, "Could not add the materials.")),
      },
    );
  }

  const hasRows = rows.length > 0;
  const processing = startImport.isPending || Boolean(jobId);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Import materials from a BoQ"
      description="Upload a PDF, Excel or CSV bill of quantities. We'll extract the materials in the background so you can review and add them."
      submitLabel={hasRows ? `Add ${rows.length} material${rows.length === 1 ? "" : "s"}` : "Add materials"}
      submitDisabled={!hasRows}
      submitting={bulkCreate.isPending}
      error={error}
      onSubmit={handleConfirm}
      className="w-[min(720px,100vw)]"
    >
      {!hasRows && !processing && (
        <div className="flex flex-1 flex-col justify-center">
          <FileUpload accept=".pdf,.xlsx,.xls,.csv" onChange={handleFile} />
        </div>
      )}

      {processing && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Spinner size="md" />
          <p className="text-sm font-medium text-gray-900">Extracting materials…</p>
          <p className="text-xs text-gray-500">
            We're reading the BoQ and pulling out the materials. This can take a moment for large bills.
          </p>
        </div>
      )}

      {hasRows && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {rows.length} material{rows.length === 1 ? "" : "s"} found. Review and edit before adding.
            </p>
            <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#004DE7]">
              {usedAi ? "AI extracted" : "Auto extracted"}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[#EDEDED]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#FAFAFA] text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="w-20 px-2 py-2">Qty</th>
                  <th className="w-24 px-2 py-2">Unit</th>
                  <th className="w-40 px-2 py-2">Est. cost ({currency})</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-[#F0F0F0]">
                    <td className="px-3 py-1.5">
                      <input
                        value={row.materialName}
                        onChange={(e) => updateRow(i, { materialName: e.target.value })}
                        className={CELL}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 0 })}
                        className={CELL}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <UnitInput value={row.unit} onChange={(v) => updateRow(i, { unit: v })} className={CELL} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center rounded-md bg-[#F6F6F6] focus-within:ring-2 focus-within:ring-gray-900/10">
                        <span className="pl-2 text-sm text-gray-400">{symbol}</span>
                        <input
                          inputMode="numeric"
                          value={groupNumber(row.estimatedCost)}
                          onChange={(e) => updateRow(i, { estimatedCost: parseGrouped(e.target.value) })}
                          className="h-9 w-full bg-transparent px-1.5 text-sm tabular-nums text-gray-900 outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-gray-400 outline-none hover:text-red-500"
                        aria-label="Remove material"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setRows([])}
            className="self-start text-xs font-medium text-[#004DE7] hover:underline"
          >
            Upload a different file
          </button>
        </div>
      )}
    </FormDrawer>
  );
}

ImportBoqDialog.displayName = "ImportBoqDialog";

export { ImportBoqDialog };
