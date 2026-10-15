import { useContentFileUrl } from "@/hooks/use-content-files";
import { Spinner } from "@/components/atoms/spinner";
import type { ContentImage as ImageReference } from "@buildpanda/rich-content";
import type { ReactNode } from "react";

/** Safe inside clickable cards: opening an attachment never follows the card. */
export function ContentFileLink({ fileId, projectId, children }: { fileId: string; projectId?: string; children: ReactNode }) {
  const { url } = useContentFileUrl(fileId, projectId);
  return <FileLink url={url}>{children}</FileLink>;
}

function FileLink({ url, children, label }: { url?: string; children: ReactNode; label?: string }) {
  const open = () => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };
  return <span role="link" tabIndex={url ? 0 : -1} aria-disabled={!url} aria-label={label}
    className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2"
    onClick={(event) => { event.preventDefault(); event.stopPropagation(); open(); }}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); open(); } }}>
    {children}
  </span>;
}

export function ContentImage({ image, projectId }: { image: ImageReference; projectId?: string }) {
  const { url, failed, pending } = useContentFileUrl(image.fileId, projectId);
  if (!url) return <span className="my-2 flex min-h-12 items-center gap-2 rounded border border-line-hair px-3 text-sm text-ink-muted">
    {pending ? <Spinner size="xs" /> : null}{failed ? `Image unavailable: ${image.name}` : `Image: ${image.name}`}
  </span>;
  return <FileLink url={url} label={`Open ${image.name}`}>
    <img src={url} alt={image.name} loading="lazy" className="my-2 max-h-80 max-w-full rounded-lg object-contain" />
  </FileLink>;
}
ContentImage.displayName = 'ContentImage';
