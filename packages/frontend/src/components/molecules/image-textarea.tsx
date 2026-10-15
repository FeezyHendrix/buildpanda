import { cn } from "@/lib/utils";
import { useRef, type ChangeEvent, type TextareaHTMLAttributes } from "react";
import { ImagePlus, X } from "lucide-react";
import { appendImage, contentParts, MAX_CONTENT_IMAGES, removeImage, textWithImages, textWithoutImages } from "@buildpanda/rich-content";
import { useContentUpload } from "@/hooks/use-content-files";
import { Button } from "@/components/atoms/button";
import { ContentImage } from "./content-image";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> { projectId?: string; containerClassName?: string; onCommit?: () => void }

/** Adds images without changing a plain field's text API or introducing HTML. */
export function ImageTextarea({ value, onChange, projectId, disabled, readOnly, className, containerClassName, onCommit, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(String(value ?? ''));
  latest.current = String(value ?? '');
  const upload = useContentUpload(projectId);
  const images = contentParts(latest.current).flatMap((part) => part.type === 'image' ? [part.image] : []);
  function change(next: string) {
    if (!textarea.current || disabled || readOnly) return;
    if (props.maxLength && next.length > props.maxLength) { upload.setError(`This field allows ${props.maxLength} characters, including image references.`); return; }
    onChange?.({ target: { value: next, name: props.name, id: props.id }, currentTarget: { value: next, name: props.name, id: props.id } } as ChangeEvent<HTMLTextAreaElement>);
    textarea.current.dispatchEvent(new Event('input', { bubbles: true }));
  }
  async function pick(file: File) {
    if (images.length >= MAX_CONTENT_IMAGES) { upload.setError(`Add up to ${MAX_CONTENT_IMAGES} images per field.`); return; }
    try { const image = await upload.upload(file); change(appendImage(latest.current, image)); textarea.current?.focus(); }
    catch (error) { upload.setError(error instanceof Error ? error.message : 'Could not add this image.'); }
  }
  return <div className={cn("flex min-w-0 flex-col gap-2", containerClassName)} data-content-upload-pending={upload.pending || undefined}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !upload.pending) onCommit?.(); }}>
    <textarea {...props} className={cn("w-full rounded-lg border border-line-hair px-3 py-2 text-sm outline-none focus:border-primary-500", className)} ref={textarea} disabled={disabled} readOnly={readOnly} value={textWithoutImages(latest.current)}
      onChange={(event) => change(textWithImages(event.target.value, latest.current))}
      onDragOver={(event) => { props.onDragOver?.(event); if (event.dataTransfer.types.includes('Files') && upload.canUpload && !disabled && !readOnly) event.preventDefault(); }}
      onPaste={(event) => { props.onPaste?.(event); const file = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/')); if (file && upload.canUpload && !disabled && !readOnly) { event.preventDefault(); void pick(file); } }}
      onDrop={(event) => { props.onDrop?.(event); const file = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith('image/')); if (file && upload.canUpload && !disabled && !readOnly) { event.preventDefault(); void pick(file); } }} />
    {images.map((image, index) => <div key={`${image.fileId}:${index}`} className="relative w-fit max-w-full">
      <ContentImage image={image} projectId={projectId} />
      {!disabled && !readOnly ? <button type="button" aria-label={`Remove ${image.name}`} className="absolute right-1 top-3 flex size-9 items-center justify-center rounded-full border border-line-hair bg-white"
        onMouseDown={(event) => event.preventDefault()} onClick={() => { textarea.current?.focus(); change(removeImage(latest.current, image.fileId)); }}><X size={16} /></button> : null}
    </div>)}
    {upload.canUpload && !disabled && !readOnly ? <>
      <Button type="button" variant="ghost" size="sm" className="w-fit" loading={upload.pending} onClick={() => input.current?.click()}><ImagePlus size={16} />Add image</Button>
      <input ref={input} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void pick(file); event.target.value = ''; }} />
    </> : null}
    {upload.pending ? <p role="status" className="text-xs text-ink-muted">Uploading image. Wait before saving.</p> : null}
    {upload.error ? <p role="alert" className="text-xs text-red-600">{upload.error}</p> : null}
  </div>;
}
ImageTextarea.displayName = 'ImageTextarea';
