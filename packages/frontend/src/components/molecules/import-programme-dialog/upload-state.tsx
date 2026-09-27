import { useState, useRef, useCallback, type DragEvent } from "react";
import { ReactSVG } from "react-svg";
import { cn } from "@/lib/utils";
import { icons } from "@/assets/icons/icons";

const ACCEPT =
  ".xml,.xls,.xlsx,text/xml,application/xml,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
          "flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white px-6 py-14 text-center transition-colors",
          dragging ? "border-primary-500 bg-primary-50" : "border-line-hair hover:border-primary-500/50",
          isPending && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="mb-4 inline-flex size-14 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
          <ReactSVG src={icons.upload} className="size-6" />
        </span>
        <span className="mb-2 text-lg font-semibold text-ink">
          {isPending ? "Uploading…" : "Upload schedule file"}
        </span>
        <span className="max-w-sm text-sm text-ink-muted">
          Drag and drop your file here, or click to browse.
        </span>
        <span className="mt-3 text-xs font-medium text-ink-muted">
          Accepts .xml · .xls · .xlsx
        </span>
      </button>

      <div className="mt-4 rounded-lg border border-line-hair bg-primary-50 p-4">
        <p className="mb-2 text-sm font-semibold text-ink">Using Microsoft Project?</p>
        <ol className="list-decimal space-y-1 pl-4 text-sm text-ink-subtle">
          <li>Open your schedule in Microsoft Project.</li>
          <li>
            Go to <span className="font-medium text-ink">File → Save As</span> and choose{" "}
            <span className="font-medium text-ink">XML (*.xml)</span> as the file type.
          </li>
          <li>Upload the saved <span className="font-medium text-ink">.xml</span> file here.</li>
        </ol>
        <p className="mt-2 text-xs text-ink-muted">
          Exporting to XML preserves your tasks, dependencies, % complete and milestones. Excel
          (.xls/.xlsx) schedules work too.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-negative-50 p-3 text-sm text-negative-600">{error}</div>
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
