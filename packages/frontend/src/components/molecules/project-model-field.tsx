import { useRef, useState } from "react";
import { Button } from "@/components/atoms/button";

interface Props { file?: File; onChange?: (files: FileList | null) => void }

export function ProjectModelField({ file, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function select(files: FileList | null) {
    if (!files?.length) return;
    if (files.length > 1 || !/\.ifc$/i.test(files[0]!.name)) {
      setError("Choose one IFC model file.");
      return;
    }
    setError(null);
    onChange?.(files);
  }

  return <section aria-label="Project model" className="border-t border-line-hair pt-6">
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-semibold text-ink">3D model (BIM)</h3>
      <span className="text-xs text-ink-muted">Optional</span>
    </div>
    <p className="mt-2 text-sm leading-6 text-ink-muted">Add an IFC model from your architect now, or upload one after creating the project.</p>
    <div className="mt-4 flex flex-col gap-4 rounded-lg bg-surface-alt p-4 sm:flex-row sm:items-center"
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); select(event.dataTransfer.files); }}>
      <div className="min-w-0 flex-1">
        <p className="break-all text-sm font-medium text-ink">{file?.name ?? "Choose or drop an IFC file"}</p>
        <p className="mt-1 text-xs text-ink-muted">{file ? "Ready to upload when you create the project." : "You can continue without a model."}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>{file ? "Replace file" : "Choose file"}</Button>
        {file ? <Button variant="ghost" size="sm" onClick={() => { onChange?.(null); setError(null); }}>Remove</Button> : null}
      </div>
      <input ref={input} type="file" accept=".ifc" aria-label="IFC model" className="hidden"
        onChange={event => { select(event.target.files); event.target.value = ""; }} />
    </div>
    {error ? <p role="alert" className="mt-2 text-sm text-negative-600">{error}</p> : null}
  </section>;
}
ProjectModelField.displayName = "ProjectModelField";
