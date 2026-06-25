import { Link } from "react-router-dom";
import { parseLinks, firstExternalUrl } from "@/lib/linkify";
import { useLinkPreview } from "@/hooks/use-chat";

export function LinkText({ text }: { text: string }) {
  const segments = parseLinks(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "internal") {
          return (
            <Link key={i} to={seg.href} className="text-primary-500 underline underline-offset-2 hover:text-primary-600">
              {seg.label}
            </Link>
          );
        }
        if (seg.kind === "external") {
          return (
            <a
              key={i}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 underline underline-offset-2 hover:text-primary-600"
            >
              {seg.label}
            </a>
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </>
  );
}

export function LinkPreviewCard({ text }: { text: string }) {
  const url = firstExternalUrl(text);
  const { data: preview } = useLinkPreview(url);

  if (!url || !preview || !preview.title) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-md gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-sm"
    >
      {preview.image && (
        <img src={preview.image} alt="" className="h-20 w-20 shrink-0 object-cover" loading="lazy" />
      )}
      <div className="min-w-0 flex-1 py-2 pr-3">
        {preview.siteName && (
          <div className="truncate text-[11px] uppercase tracking-wide text-gray-400">{preview.siteName}</div>
        )}
        <div className="truncate text-[13px] font-semibold text-gray-900">{preview.title}</div>
        {preview.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">{preview.description}</div>
        )}
      </div>
    </a>
  );
}
