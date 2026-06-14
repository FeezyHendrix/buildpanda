import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

interface ShareMeta {
  available: boolean;
  fileName: string;
  projectName?: string;
  mimeType?: string | null;
  expiresAt?: string | null;
  fileUrl?: string;
}

function isImage(mime: string | null | undefined, name: string): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
}

function isPdf(mime: string | null | undefined, name: string): boolean {
  return mime === "application/pdf" || /\.pdf$/i.test(name);
}

export default function SharePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/share/${token}`);
        if (!res.ok) throw new Error("not found");
        const data = (await res.json()) as ShareMeta;
        if (active) setMeta(data);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const fileHref = `${API_BASE}/share/${token}/file`;

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#FCFCFD]">
        <div className="size-8 animate-spin rounded-full border-2 border-[#004DE7] border-t-transparent" />
      </div>
    );
  }

  if (failed || !meta || !meta.available) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#FCFCFD] p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[#FFF0F0] text-[#D14343]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8v5M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">This link is no longer available</h1>
          <p className="mt-2 text-sm text-gray-500">
            The shared file may have expired or been revoked by its owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#FCFCFD]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#EDEDED] bg-white px-6 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{meta.fileName}</p>
          {meta.projectName ? (
            <p className="truncate text-xs text-gray-500">Shared from {meta.projectName}</p>
          ) : null}
        </div>
        <a
          href={fileHref}
          download={meta.fileName}
          className="shrink-0 rounded-lg bg-[#004DE7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0046D2]"
        >
          Download
        </a>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {isPdf(meta.mimeType, meta.fileName) ? (
          <iframe title={meta.fileName} src={fileHref} className="h-full w-full border-0" />
        ) : isImage(meta.mimeType, meta.fileName) ? (
          <div className="flex h-full w-full items-center justify-center overflow-auto p-6">
            <img src={fileHref} alt={meta.fileName} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[#F0F4FF] text-[#004DE7]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">Preview not available</h2>
              <p className="mt-1 text-sm text-gray-500">This file type can't be previewed in the browser.</p>
              <a
                href={fileHref}
                download={meta.fileName}
                className="mt-4 inline-block rounded-lg bg-[#004DE7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0046D2]"
              >
                Download {meta.fileName}
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
