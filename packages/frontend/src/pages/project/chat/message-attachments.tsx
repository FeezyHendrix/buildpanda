import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { FileViewerDialog } from "@/components/molecules/file-viewer-dialog";
import { formatCompactFileSize } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ChatMessage, MediaItem } from "@/lib/project-types";
import { downloadAttachment } from "./download-attachment";
import { markFileDownloaded, useIsFileDownloaded } from "./use-downloaded-files";

export type ChatAttachment = ChatMessage["attachments"][number];

export function isImageAttachment(attachment: ChatAttachment): boolean {
  return (attachment.mime ?? "").startsWith("image/");
}

/** Images open in the shared lightbox; every other file opens in the document viewer. */
export function splitAttachments(attachments: ChatMessage["attachments"] | undefined): {
  images: ChatAttachment[];
  files: ChatAttachment[];
} {
  const list = attachments ?? [];
  return {
    images: list.filter(isImageAttachment),
    files: list.filter((a) => !isImageAttachment(a)),
  };
}

const CARD_TONE = {
  own: {
    card: "border-[#1B4EB1] bg-[#053DAB] text-white",
    size: "text-[#9BB1DD]",
    icon: "[&_path]:fill-white",
    action: "text-white hover:bg-white/10",
  },
  other: {
    card: "border-[#F2F2F2] bg-white text-[#1E1E1E]",
    size: "text-[#787878]",
    icon: "",
    action: "text-[#1E1E1E] hover:bg-black/5",
  },
} as const;

/**
 * One file in a message: tap it to read it in the document viewer. The download
 * button is there until this browser has downloaded the file, then it goes.
 */
export function FileAttachmentCard({ attachment, own }: { attachment: ChatAttachment; own: boolean }) {
  const [viewing, setViewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const downloaded = useIsFileDownloaded(attachment.fileId);
  const tone = CARD_TONE[own ? "own" : "other"];
  const size = attachment.size ? formatCompactFileSize(attachment.size) : null;

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    try {
      await downloadAttachment(attachment);
      markFileDownloaded(attachment.fileId);
    } catch {
      toast("Could not download the file. Try again.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={cn("flex min-h-[47px] items-center gap-[12px] border py-[7px] pl-[8px] pr-[4px]", tone.card)}>
      <button
        type="button"
        onClick={() => setViewing(true)}
        aria-label={`Open ${attachment.name}`}
        className="flex min-w-0 flex-1 items-center gap-[8px] text-left outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <ReactSVG src={icons2.file} className={cn("shrink-0 [&_svg]:block", tone.icon)} />
        <span className="flex min-w-0 flex-col">
          <span className="max-w-[220px] truncate text-[12px] font-medium leading-[16px] tracking-[-0.02em]">{attachment.name}</span>
          {size ? <span className={cn("text-[12px] leading-[14px] tracking-[-0.02em]", tone.size)}>{size}</span> : null}
        </span>
      </button>

      {downloaded ? null : (
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloading}
          aria-busy={downloading}
          aria-label={downloading ? `Downloading ${attachment.name}` : `Download ${attachment.name}`}
          className={cn("flex size-[24px] shrink-0 items-center justify-center outline-none transition-colors", tone.action)}
        >
          {downloading ? (
            <Loader2 className="size-[16px] animate-spin motion-reduce:animate-none" strokeWidth={2} />
          ) : (
            <Download className="size-[16px]" strokeWidth={2} />
          )}
        </button>
      )}

      <FileViewerDialog
        open={viewing}
        onOpenChange={setViewing}
        title={attachment.name}
        fileName={attachment.name}
        url={attachment.url}
        fileSize={size}
      />
    </div>
  );
}

FileAttachmentCard.displayName = "FileAttachmentCard";

/** A message's images, in the shared gallery (tap one for the lightbox). */
export function ImageAttachments({ images }: { images: ChatAttachment[] }) {
  if (images.length === 0) return null;
  const items: MediaItem[] = images.map((a) => ({ id: a.fileId, type: "photo", url: a.url }));
  return <MediaGallery items={items} aspectRatio="4/3" className="max-w-full pb-0" />;
}

ImageAttachments.displayName = "ImageAttachments";
