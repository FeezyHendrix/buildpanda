import { useState, useRef, type DragEvent } from "react";
import { useAttachSessionDocument } from "@/hooks/use-import-session";
import { uploadFileRequest } from "@/hooks/use-files";
import { documentsApi } from "@/api/documents";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const ACCEPT = ".dwg,.dxf,.pdf,application/pdf,application/acad,image/vnd.dwg,image/vnd.dxf";

interface DrawingsStepProps {
  sessionId: string;
  projectId: string;
  onNext: () => void;
}

export function DrawingsStep({ sessionId, projectId, onNext }: DrawingsStepProps) {
  const attachDocument = useAttachSessionDocument();
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successCount, setSuccessCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setErrorMsg("");
    let count = 0;

    try {
      const categories = await documentsApi.categories(projectId);
      let targetCat = categories.find((c) => c.name === "Drawings");
      if (!targetCat) {
        targetCat = categories[0];
      }

      if (!targetCat) throw new Error("No document categories found");

      for (const file of fileArray) {
        const uploaded = await uploadFileRequest(file);
        await documentsApi.create(projectId, {
          categoryId: targetCat.id,
          fileId: uploaded.id,
        });

        await attachDocument.mutateAsync({
          sessionId,
          kind: "drawing",
          fileName: file.name,
          status: "applied"
        });

        count++;
      }
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to upload drawings"));
    }

    setUploading(false);
    if (count > 0 && !errorMsg) {
      setSuccessCount(prev => prev + count);
      setTimeout(() => onNext(), 2000);
    }
  };

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col max-w-xl mx-auto mt-8 gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upload Drawings</h2>
        <p className="text-gray-500">Optional. Upload PDF or CAD files to store them in your project's document register.</p>
        <p className="text-sm text-gray-400 mt-2">Note: CAD files (.dwg, .dxf) are stored safely but are not previewable in the browser.</p>
      </div>

      {successCount > 0 && !uploading && (
        <div className="flex flex-col items-center p-6 text-center">
          <div className="rounded-full bg-green-100 p-3 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">Success!</h3>
          <p className="text-gray-500 mt-2">Successfully uploaded {successCount} drawing(s).</p>
        </div>
      )}

      {(!successCount || uploading || errorMsg) && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors",
            isDragging ? "border-[#004DE7] bg-primary-50" : "border-gray-200 bg-white hover:bg-gray-50",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-[#004DE7]" />
              <span className="text-sm font-medium text-gray-900">Uploading drawings...</span>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-full bg-gray-100 p-3">
                <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="mb-1 text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
              <p className="mb-4 text-xs text-gray-500">.pdf, .dwg, or .dxf files</p>
              <Button onClick={() => fileInputRef.current?.click()} variant="secondary">Select Files</Button>
              <input 
                type="file" 
                className="hidden" 
                accept={ACCEPT} 
                multiple
                ref={fileInputRef} 
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.target.value = "";
                }} 
              />
            </>
          )}
        </div>
      )}

      {errorMsg && <p className="text-sm text-red-600 text-center">{errorMsg}</p>}
    </div>
  );
}
