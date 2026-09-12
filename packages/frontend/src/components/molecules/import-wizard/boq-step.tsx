import { useState, useRef, type DragEvent } from "react";
import { useStartBoqImport, useBoqImportJob, useBulkCreateMaterials } from "@/hooks/use-materials-equipment";
import { useAttachSessionDocument } from "@/hooks/use-import-session";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const ACCEPT = ".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

interface BoqStepProps {
  sessionId: string;
  projectId: string;
  onNext: () => void;
}

export function BoqStep({ sessionId, projectId, onNext }: BoqStepProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const startMutation = useStartBoqImport();
  const { data: job } = useBoqImportJob(projectId, jobId);
  const bulkCreate = useBulkCreateMaterials();
  const attachDocument = useAttachSessionDocument();

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await startMutation.mutateAsync({ projectId, file });
      setJobId(res.id);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to upload file"));
    }
  };

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleApply = async () => {
    if (!job?.materials) return;
    setErrorMsg("");
    try {
      const res = await bulkCreate.mutateAsync({
        projectId,
        materials: job.materials
      });
      
      const createdMats = res.created;
      const createdCats = res.budgetCategories?.created || 0;
      setSuccessMsg(`Added ${createdMats} materials and ${createdCats} budget categories.`);
      
      await attachDocument.mutateAsync({
        sessionId,
        kind: "boq",
        jobId: jobId!,
        status: "applied"
      });
      setTimeout(() => onNext(), 2000);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to apply materials"));
    }
  };

  const isPending = job?.status === "pending" || job?.status === "processing";

  return (
    <div className="flex flex-col max-w-xl mx-auto mt-8">
      <h2 className="text-2xl font-semibold text-ink mb-2">Upload Bill of Quantities (BoQ)</h2>
      <p className="text-ink-muted mb-8">Optional. Upload an Excel or CSV file to import your materials and equipment list.</p>
      
      {successMsg ? (
        <div className="flex flex-col items-center p-12 text-center">
          <div className="rounded-full bg-success-50 p-3 mb-4">
            <svg className="h-6 w-6 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-ink">Success!</h3>
          <p className="text-ink-muted mt-2">{successMsg}</p>
        </div>
      ) : !jobId ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
            isDragging ? "border-primary-500 bg-primary-50" : "border-line bg-white hover:bg-surface-alt",
            startMutation.isPending && "pointer-events-none opacity-50"
          )}
        >
          {startMutation.isPending ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-primary-500" />
              <span className="text-sm font-medium text-ink">Uploading...</span>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-full bg-surface-alt p-3">
                <svg className="h-6 w-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="mb-1 text-sm font-medium text-ink">Click to upload or drag and drop</p>
              <p className="mb-4 text-xs text-ink-muted">.xls, .xlsx, or .csv files</p>
              <Button onClick={() => fileInputRef.current?.click()} variant="secondary">Select File</Button>
              <input type="file" className="hidden" accept={ACCEPT} ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }} />
            </>
          )}
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center p-12 text-center">
          <Spinner className="h-10 w-10 text-primary-500 mb-4" />
          <h3 className="text-lg font-medium">Parsing BoQ...</h3>
          <p className="text-ink-muted mt-2">Extracting materials and quantities.</p>
        </div>
      ) : job?.status === "completed" && job.materials ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">Review Data</h3>
              <p className="text-ink-muted text-sm">Found {job.materialCount} materials</p>
            </div>
            <Button variant="secondary" onClick={() => setJobId(null)}>Upload Different File</Button>
          </div>
          
          <div className="max-h-64 overflow-y-auto rounded-lg border border-line-hair">
            <Table>
              <TableHead className="sticky top-0">
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell align="right">Qty</TableHeaderCell>
                  <TableHeaderCell>Unit</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody className="bg-white">
                {job.materials.slice(0, 50).map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.materialName}</TableCell>
                    <TableCell align="right" className="text-ink-subtle">{m.quantity}</TableCell>
                    <TableCell className="text-ink-subtle">{m.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {job.materials.length > 50 && (
              <div className="p-3 text-center text-xs text-ink-muted bg-surface-alt">
                Showing first 50 items...
              </div>
            )}
          </div>

          <Button 
            onClick={handleApply} 
            loading={bulkCreate.isPending}
            className="w-full"
          >
            Apply BoQ Data
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center p-12 text-center">
          <div className="rounded-full bg-negative-50 p-3 mb-4">
            <svg className="h-6 w-6 text-negative-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-ink">Failed to parse file</h3>
          <p className="text-ink-muted mt-2">{job?.error || "Could not read materials."}</p>
          <Button onClick={() => setJobId(null)} variant="secondary" className="mt-6">Try again</Button>
        </div>
      )}
      
      {errorMsg && <p className="mt-4 text-sm text-negative-500 text-center">{errorMsg}</p>}
    </div>
  );
}
