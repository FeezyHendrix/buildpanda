import { useState, useRef, useCallback, type DragEvent } from "react";
import { ReactSVG } from "react-svg";
import { cn } from "@/lib/utils";
import { icons } from "@/assets/icons/icons";

const ACCEPT =
  ".mpp,.xml,.xls,.xlsx,application/vnd.ms-project,text/xml,application/xml,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function UploadState({
  isPending,
  onFileSelect,
  error,
}: {
  isPending: boolean;
  onFileSelect: (f: File) => void;
  error: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);

  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    setDragging(false);
    if (isPending) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-14 text-center transition-colors",
          dragging ? "border-[#004DE7] bg-[#F0F4FF]" : "border-[#EDEDED] hover:border-[#004DE7]/50",
          isPending && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[#F0F4FF] text-[#004DE7]">
          <ReactSVG src={icons.upload} className="size-6" />
        </span>
        <span className="mb-2 text-lg font-semibold text-gray-900">
          {isPending ? "Uploading…" : "Upload schedule file"}
        </span>
        <span className="max-w-sm text-sm text-gray-500">
          Drag and drop your file here, or click to browse.
        </span>
        <span className="mt-3 text-xs font-medium text-gray-400">
          Accepts .mpp · .xml · .xls · .xlsx
        </span>
      </button>

      <div className="mt-4 rounded-xl border border-[#EDEDED] bg-[#FAFBFF] p-4">
        <p className="mb-2 text-sm font-semibold text-gray-900">Using Microsoft Project?</p>
        <ol className="list-decimal space-y-1 pl-4 text-sm text-gray-600">
          <li>Open your schedule in Microsoft Project.</li>
          <li>
            Go to <span className="font-medium text-gray-800">File → Save As</span> and choose{" "}
            <span className="font-medium text-gray-800">XML (*.xml)</span> as the file type.
          </li>
          <li>Upload the saved <span className="font-medium text-gray-800">.xml</span> file here.</li>
        </ol>
        <p className="mt-2 text-xs text-gray-400">
          Exporting to XML preserves your tasks, dependencies, % complete and milestones. Excel
          (.xls/.xlsx) schedules work too.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
