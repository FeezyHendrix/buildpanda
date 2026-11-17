import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { imageError } from "@buildpanda/rich-content";
import { Input } from "@field-ui/input";
import { Spinner } from "@field-ui/spinner";
import { agentApi } from "../api/agent";
import type { ToolOption, UploadedFile } from "../api/tool-types";

const RichTextEditorCore = lazy(() => import("@buildpanda/rich-text-editor").then((module) => ({ default: module.RichTextEditorCore })));

function useReviewUpload(projectId: string, enabled: boolean, onPending: (delta: number) => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState("upload");
  const current = useRef({ projectId, enabled, mounted: true });
  const inFlight = useRef(false);
  current.current = { projectId, enabled, mounted: current.current.mounted };
  useEffect(() => { current.current.mounted = true; return () => { current.current.mounted = false; }; }, []);
  async function perform(load: () => Promise<UploadedFile>, operation: "upload" | "metadata") {
    if (!current.current.enabled || inFlight.current) throw new Error("Refresh your access before uploading another file.");
    const selectedProject = current.current.projectId;
    inFlight.current = true; setPending(true); setError(""); setOperation(operation); onPending(1);
    try {
      const result = await load();
      if (!current.current.mounted || current.current.projectId !== selectedProject) throw new Error("Project changed. Choose the file in the current review.");
      return result;
    } catch (failure) {
      if (current.current.mounted) setError(failure instanceof Error ? failure.message : "Could not upload this file.");
      throw failure;
    } finally {
      inFlight.current = false;
      if (current.current.mounted) { setPending(false); onPending(-1); }
    }
  }
  return { upload: (file: File) => perform(() => agentApi.uploadFile(projectId, file), "upload"), select: (fileId: string) => perform(() => agentApi.fileMetadata(fileId), "metadata"), operation, pending, error, setError };
}

export function ReviewFile({ projectId, disabled, uploads, options, label, value, onChange, onPending }: {
  projectId: string; disabled: boolean; label: string; value: unknown;
  uploads: boolean; options: ToolOption[];
  onChange: (file: UploadedFile) => void; onPending: (delta: number) => void;
}) {
  const upload = useReviewUpload(projectId, !disabled, onPending);
  return <div className="space-y-2">
    {typeof value === "string" && value ? <p className="text-xs text-ink-muted">An uploaded file is selected. Choose a replacement only if needed.</p> : null}
    {options.length ? <select aria-label={`${label} uploaded file`} className="min-h-12 w-full rounded-lg border border-line px-3 text-sm" value={typeof value === "string" ? value : ""} disabled={disabled || upload.pending} onChange={(event) => { if (event.target.value) void upload.select(event.target.value).then(onChange).catch(() => undefined); }}><option value="">Choose an uploaded file</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : null}
    {uploads ? <Input type="file" aria-label={label} disabled={disabled || upload.pending} onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (file) void upload.upload(file).then(onChange).catch(() => undefined);
    }} /> : <p className="text-xs text-ink-muted">Your current access does not allow uploading a new file here.</p>}
    {upload.pending ? <p role="status" className="text-sm text-ink-muted">{upload.operation === "upload" ? "Uploading file. Wait before saving." : "Loading file details. Wait before saving."}</p> : null}
    {upload.error ? <p role="alert" className="text-sm text-danger-600">{upload.error}</p> : null}
  </div>;
}

export function ReviewRichText({ projectId, disabled, label, value, images, onChange, onPending }: {
  projectId: string; disabled: boolean; label: string; value: string; images: boolean;
  onChange: (html: string, text: string) => void; onPending: (delta: number) => void;
}) {
  const upload = useReviewUpload(projectId, !disabled && images, onPending);
  return <Suspense fallback={<Spinner label="Loading editor" />}><RichTextEditorCore value={value} onChange={onChange} disabled={disabled} ariaLabel={label}
    uploadIndicator={<Spinner size="xs" />} onUploadError={upload.setError} resolveFile={agentApi.fileUrl}
    upload={{ pending: upload.pending, error: upload.error, ready: true, canUpload: !disabled && images, key: projectId, async upload(file) {
      const invalid = imageError(file.type, file.size);
      if (invalid) throw new Error(invalid);
      const result = await upload.upload(file);
      return { fileId: result.id, name: result.fileName };
    } }} /></Suspense>;
}
