import { IfcExportGuide } from "@/components/molecules/ifc-export-guide";

interface ModelsStepProps {
  sessionId: string;
  projectId: string;
  onNext: () => void;
}

// IFC upload temporarily disabled. Original implementation preserved below; the
// step now just shows the export guide and is skipped via the wizard footer.
//
// import { useState, useRef, type DragEvent } from "react";
// import { useAttachSessionDocument } from "@/hooks/use-import-session";
// import { Button } from "@/components/atoms/button";
// import { Spinner } from "@/components/atoms/spinner";
// import { api } from "@/api/client";
// import { getApiErrorMessage } from "@/lib/api-error";
// import { cn } from "@/lib/utils";
//
// export function ModelsStep({ sessionId, projectId, onNext }: ModelsStepProps) {
//   const attachDocument = useAttachSessionDocument();
//   const [uploading, setUploading] = useState(false);
//   const [errorMsg, setErrorMsg] = useState("");
//   const [successCount, setSuccessCount] = useState(0);
//   const [isDragging, setIsDragging] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//
//   const handleFiles = async (files: FileList | File[]) => {
//     const fileArray = Array.from(files).filter(f => /\.ifc$/i.test(f.name));
//     if (fileArray.length === 0) {
//       setErrorMsg("Please select valid .ifc files.");
//       return;
//     }
//     setUploading(true);
//     setErrorMsg("");
//     let count = 0;
//     for (const file of fileArray) {
//       try {
//         const { data: ticket } = await api.post<{ mode: string; storagePath: string; url?: string }>(
//           `/projects/${projectId}/bim/upload-url`,
//           { fileName: file.name, sizeBytes: file.size },
//         );
//         if (ticket.mode !== "single" || !ticket.url) throw new Error("Invalid upload ticket");
//         await fetch(ticket.url, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: file });
//         await api.post(`/projects/${projectId}/bim/models`, {
//           name: file.name.replace(/\.ifc$/i, ""),
//           fileName: file.name,
//           storagePath: ticket.storagePath,
//           sizeBytes: file.size,
//         });
//         await attachDocument.mutateAsync({ sessionId, kind: "ifc", fileName: file.name, status: "applied" });
//         count++;
//       } catch (err) {
//         setErrorMsg(getApiErrorMessage(err, `Failed to upload ${file.name}`));
//         break;
//       }
//     }
//     setUploading(false);
//     if (count > 0 && !errorMsg) {
//       setSuccessCount(prev => prev + count);
//       setTimeout(() => onNext(), 2000);
//     }
//   };
//
//   const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
//   const onDragLeave = () => setIsDragging(false);
//   const onDrop = (e: DragEvent) => {
//     e.preventDefault();
//     setIsDragging(false);
//     if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
//   };
//
//   return (
//     <div className="flex flex-col max-w-2xl mx-auto mt-8 gap-8">
//       <div className="text-center">
//         <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upload BIM Models</h2>
//         <p className="text-gray-500">Optional. Upload one or more .ifc files to view them in the model viewer.</p>
//       </div>
//       {successCount > 0 && !uploading && (
//         <div className="flex flex-col items-center p-6 text-center">
//           <div className="rounded-full bg-green-100 p-3 mb-4">
//             <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//             </svg>
//           </div>
//           <h3 className="text-lg font-medium text-gray-900">Success!</h3>
//           <p className="text-gray-500 mt-2">Successfully uploaded {successCount} model(s).</p>
//         </div>
//       )}
//       {(!successCount || uploading || errorMsg) && (
//         <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
//           className={cn(
//             "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors",
//             isDragging ? "border-[#004DE7] bg-primary-50" : "border-gray-200 bg-white hover:bg-gray-50",
//             uploading && "pointer-events-none opacity-50",
//           )}
//         >
//           {uploading ? (
//             <div className="flex flex-col items-center gap-3">
//               <Spinner className="h-8 w-8 text-[#004DE7]" />
//               <span className="text-sm font-medium text-gray-900">Uploading models...</span>
//             </div>
//           ) : (
//             <>
//               <div className="mb-4 rounded-full bg-gray-100 p-3">
//                 <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
//                 </svg>
//               </div>
//               <p className="mb-1 text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
//               <p className="mb-4 text-xs text-gray-500">.ifc files only</p>
//               <Button onClick={() => fileInputRef.current?.click()} variant="secondary">Select Files</Button>
//               <input type="file" className="hidden" accept=".ifc" multiple ref={fileInputRef}
//                 onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); e.target.value = ""; }}
//               />
//             </>
//           )}
//         </div>
//       )}
//       {errorMsg && <p className="text-sm text-red-600 text-center">{errorMsg}</p>}
//       <div className="mt-4"><IfcExportGuide /></div>
//     </div>
//   );
// }

export function ModelsStep(_props: ModelsStepProps) {
  return (
    <div className="flex flex-col max-w-2xl mx-auto mt-8 gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">BIM Models</h2>
        <p className="text-gray-500">
          You can add BIM models to this project later. Continue to the next step.
        </p>
      </div>

      <div className="mt-4">
        <IfcExportGuide />
      </div>
    </div>
  );
}
