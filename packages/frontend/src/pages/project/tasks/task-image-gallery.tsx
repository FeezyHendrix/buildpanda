import { useEffect, useState } from "react";
import { resolveFileUrl, uploadFileRequest } from "@/hooks/use-files";
import { FileViewerDialog } from "@/components/molecules/file-viewer-dialog";

interface Props {
  descriptionHtml: string;
  onDescriptionChange: (html: string, text: string) => void;
  projectId: string;
}

function allImageFileIds(html: string): string[] {
  const regex = /data-file-id="([^"]+)"/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html))) {
    if (m[1]) ids.push(m[1]);
  }
  return ids;
}

interface ResolvedImage {
  fileId: string;
  url: string;
}

export function TaskImageGallery({ descriptionHtml, onDescriptionChange, projectId }: Props) {
  const fileIds = allImageFileIds(descriptionHtml);
  const [images, setImages] = useState<ResolvedImage[]>([]);
  const [viewerImage, setViewerImage] = useState<ResolvedImage | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (fileIds.length === 0) {
      setImages([]);
      return;
    }
    void Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const url = await resolveFileUrl(fileId);
          return { fileId, url };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (!cancelled) setImages(results.filter((r): r is ResolvedImage => r !== null));
    });
    return () => { cancelled = true; };
  }, [fileIds.join(",")]);

  async function handleAddImage(file: File): Promise<void> {
    setUploading(true);
    try {
      const uploaded = await uploadFileRequest(file, undefined, projectId);
      const imgTag = `<img data-file-id="${uploaded.id}" alt="${file.name}" />`;
      const newHtml = descriptionHtml
        ? descriptionHtml.replace(/<\/p>$/, `${imgTag}</p>`)
        : `<p>${imgTag}</p>`;
      const el = document.createElement("div");
      el.innerHTML = newHtml;
      onDescriptionChange(newHtml, el.textContent ?? "");
    } catch { void 0; } finally {
      setUploading(false);
    }
  }

  if (fileIds.length === 0 && !uploading) return null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-gray-500">Attachments</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img) => (
            <button
              key={img.fileId}
              type="button"
              onClick={() => setViewerImage(img)}
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 hover:ring-2 hover:ring-[#004DE7]/40"
            >
              <img
                src={img.url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            </button>
          ))}

          <label
            className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-[#004DE7] hover:text-[#004DE7]"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAddImage(file);
                e.target.value = "";
              }}
            />
            {uploading ? (
              <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </label>
        </div>
      </div>

      <FileViewerDialog
        open={viewerImage !== null}
        onOpenChange={(o) => { if (!o) setViewerImage(null); }}
        title="Task image"
        fileName="image.png"
        url={viewerImage?.url ?? ""}
      />
    </>
  );
}

TaskImageGallery.displayName = "TaskImageGallery";
