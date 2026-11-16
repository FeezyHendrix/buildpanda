import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@field-ui/button";
import { Spinner } from "@field-ui/spinner";
import { agentApi, type DocumentArtifact } from "../api/agent";
import { requestFile } from "../api/client";
import { agentKeys } from "../hooks/use-agent";
import type { ToolCatalog } from "../api/tool-types";
import { ErrorMessage, Notice } from "./notice";

const raster = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/bmp"]);
const canView = (catalog: ToolCatalog | undefined) => catalog?.tools.some((tool) => tool.kind === "open_document" || tool.kind === "download_document") === true;

export function documentPath(artifact: Pick<DocumentArtifact, "projectId" | "documentId" | "versionId">) {
  return `/projects/${encodeURIComponent(artifact.projectId)}/documents/${encodeURIComponent(artifact.documentId)}/versions/${encodeURIComponent(artifact.versionId)}/view`;
}

export function DocumentPreview({ artifact, allowed, auto = false }: { artifact: DocumentArtifact; allowed: boolean; auto?: boolean }) {
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const active = useRef({ allowed, mounted: true });
  const blobUrl = useRef<string | null>(null);
  const started = useRef(false);
  active.current.allowed = allowed;
  function clearPreview() {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null; setPreview(null);
  }
  useEffect(() => { active.current.mounted = true; return () => {
    active.current.mounted = false;
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
  }; }, []);
  useEffect(() => { if (!allowed) clearPreview(); }, [allowed]);

  async function open(download: boolean) {
    if (!active.current.allowed || pending) return;
    setPending(true); setError(null); setUnsupported(false);
    try {
      const file = await requestFile(documentPath(artifact));
      if (!active.current.allowed || !active.current.mounted) return;
      const mime = file.blob.type.split(";")[0]!.toLowerCase();
      const name = (file.fileName ?? artifact.fileName ?? "Document").replace(/[\\/\u0000-\u001f]/g, "_");
      if (download) {
        const url = URL.createObjectURL(file.blob), link = document.createElement("a");
        link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (mime === "application/pdf" || raster.has(mime)) {
        clearPreview(); const url = URL.createObjectURL(file.blob); blobUrl.current = url;
        setPreview({ url, mime, name });
      } else setUnsupported(true);
    } catch (failure) {
      if (active.current.mounted) { clearPreview(); setError(failure instanceof Error ? failure : new Error("Could not open this document.")); }
    } finally { if (active.current.mounted) setPending(false); }
  }
  useEffect(() => {
    if (auto && allowed && !started.current) { started.current = true; void open(artifact.download); }
  }, [auto, allowed]);

  return <section className="space-y-3 rounded-xl border border-line bg-white p-4" aria-label={artifact.fileName || "Document revision"}>
    <p className="font-medium">{artifact.fileName || "Document revision"}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" disabled={!allowed || pending} onClick={() => void open(false)}>Preview document</Button>
      <Button type="button" variant="secondary" disabled={!allowed || pending} onClick={() => void open(true)}>Download document</Button>
      {preview ? <Button type="button" variant="ghost" onClick={clearPreview}>Close preview</Button> : null}
    </div>
    {pending ? <Spinner label="Loading authorized document" /> : null}
    {!allowed ? <p className="text-sm text-ink-muted">Document access is unavailable with your current project permissions.</p> : null}
    {unsupported ? <p className="text-sm text-ink-muted">Preview is unavailable for this file type. Use Download document to open it on your device.</p> : null}
    {preview ? preview.mime === "application/pdf" ? <iframe title={preview.name} src={preview.url} className="h-[32rem] w-full rounded-lg border border-line" />
      : <img src={preview.url} alt={preview.name} className="max-h-[40rem] max-w-full rounded-lg object-contain" /> : null}
    <ErrorMessage error={error} />
  </section>;
}

export function ProposalDocuments({ artifacts, catalog, available }: { artifacts: DocumentArtifact[]; catalog?: ToolCatalog; available: boolean }) {
  return <div className="mt-4 space-y-3">{artifacts.map((artifact) => <DocumentPreview key={`${artifact.projectId}:${artifact.documentId}:${artifact.versionId}`} artifact={artifact} allowed={available && canView(catalog)} />)}</div>;
}

export function DocumentHandoff({ userId, projectIds }: { userId: string; projectIds: string[] }) {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId"), documentId = params.get("documentId"), versionId = params.get("versionId");
  const requested = Boolean(projectId || documentId || versionId);
  const valid = [projectId, documentId, versionId].every((id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id));
  const belongs = valid && projectIds.includes(projectId!);
  const access = useQuery({ queryKey: [...agentKeys.all, "document-access", userId, projectId], queryFn: ({ signal }) => agentApi.tools(projectId!, null, signal), enabled: requested && belongs && Boolean(userId), retry: false, refetchInterval: belongs ? 10_000 : false });
  if (!requested) return null;
  if (!valid || !belongs) return <Notice title="Document link is unavailable">Choose a document in a project your current account can access.</Notice>;
  if (access.isPending) return <Spinner label="Checking document access" />;
  if (access.isError) return <ErrorMessage error={access.error} />;
  return <DocumentPreview key={`${userId}:${projectId}:${documentId}:${versionId}`} auto artifact={{ kind: "document", projectId: projectId!, documentId: documentId!, versionId: versionId!, fileName: "Document revision", mimeType: "", download: params.get("download") === "1" }} allowed={canView(access.data)} />;
}
