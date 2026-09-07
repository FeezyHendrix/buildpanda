import { FileUpload } from "@/components/atoms/file-upload";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";

export type UploadState = "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  name: string;
  percent: number;
  state: UploadState;
  error?: string;
}

interface Props {
  uploads: UploadItem[];
  onFiles: (files: FileList | null) => void;
}

const ACCEPT = ".dwg,.pdf,.png,.jpg,.jpeg,.webp";

function UploadRow({ item }: { item: UploadItem }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex size-5 shrink-0 items-center justify-center">
        {item.state === "uploading" ? (
          <Spinner size="xs" />
        ) : item.state === "done" ? (
          <span className="size-2 rounded-full bg-success-500" aria-hidden="true" />
        ) : (
          <span className="size-2 rounded-full bg-red-500" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm text-gray-800">{item.name}</p>
          <span className={cn("shrink-0 text-xs tabular-nums", item.state === "error" ? "text-red-600" : "text-gray-500")}>
            {item.state === "uploading" ? `${item.percent}%` : item.state === "done" ? "Uploaded" : "Failed"}
          </span>
        </div>
        {item.state === "uploading" ? (
          <ProgressBar value={item.percent} max={100} size="sm" className="mt-1.5" />
        ) : item.state === "error" && item.error ? (
          <p className="mt-0.5 text-xs text-red-600">{item.error}</p>
        ) : null}
      </div>
    </li>
  );
}
UploadRow.displayName = "UploadRow";

export function PlanUploadCard({ uploads, onFiles }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <FileUpload
        height={150}
        multiple
        accept={ACCEPT}
        hint="PDF or DWG drawings can be measured by Panda AI · PNG, JPG and WEBP are kept as reference"
        onChange={onFiles}
      />
      {uploads.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {uploads.map((item) => (
            <UploadRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
PlanUploadCard.displayName = "PlanUploadCard";
