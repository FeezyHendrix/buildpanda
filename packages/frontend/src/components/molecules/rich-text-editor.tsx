import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { filesApi } from "@/api/files";
import { useContentUpload } from "@/hooks/use-content-files";
import { FILE_ID, MAX_CONTENT_IMAGES, fileIdFromPath, filePath, embeddedImages, plainTextFromHtml } from "@buildpanda/rich-content";
import { ImagePlus } from "lucide-react";
import { Spinner } from "@/components/atoms/spinner";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface UploadedAttachment {
  fileId: string;
  url: string;
  name: string;
}

export interface RichTextEditorHandle {
  insertImageFile: (file: File) => void;
}

interface Props {
  value: string;
  onChange: (html: string, text: string) => void;
  onAttach?: (attachment: UploadedAttachment) => void;
  projectId?: string;
  onReady?: (handle: RichTextEditorHandle) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

// Store canonical file references; resolve short-lived URLs only for the view.
const FileImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-file-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-file-id") ?? fileIdFromPath(el.getAttribute("src") ?? ""),
        renderHTML: (attrs) =>
          attrs["data-file-id"] ? { "data-file-id": attrs["data-file-id"] } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "img", getAttrs: (element) => {
      const id = element.getAttribute('data-file-id') ?? fileIdFromPath(element.getAttribute('src') ?? '');
      return id && FILE_ID.test(id) ? {} : false;
    } }];
  },
  renderHTML({ HTMLAttributes }) {
    if (HTMLAttributes["data-file-id"]) {
      const { src: _src, ...rest } = HTMLAttributes;
      return ["img", { ...rest, src: filePath(String(HTMLAttributes["data-file-id"])) }];
    }
    return ["img", HTMLAttributes];
  },
});

/** An empty tiptap doc serializes as "<p></p>", which is not "" — treat both as blank. */
function isBlank(html: string): boolean {
  return html.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/g, "").trim().length === 0;
}

function isSameDoc(a: string, b: string): boolean {
  if (a === b) return true;
  return isBlank(a) && isBlank(b);
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
  disabled = false,
}: {
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded px-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-primary-50 text-primary-700" : "text-ink-muted hover:bg-black/5 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, onAttach, projectId, onReady, placeholder, disabled, ariaLabel }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const upload = useContentUpload(projectId);
  const insertRef = useRef<(file: File) => void>(() => undefined);

  const editor = useEditor({
    extensions: [
      StarterKit,
      FileImage.configure({ inline: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Write a response…" }),
    ],
    content: value,
    editable: !disabled,
    // A label's htmlFor cannot name a contenteditable, so without this the
    // editor has no accessible name for screen readers or getByLabel.
    // never undefined: tiptap reads editorProps.dispatchTransaction without a
    // guard, so passing undefined here throws before the view is created
    editorProps: {
      attributes: { role: "textbox", "aria-multiline": "true", "aria-label": ariaLabel ?? placeholder ?? "Description" },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
        if (!file || disabled || !upload.canUpload) return false;
        event.preventDefault(); insertRef.current(file); return true;
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find((file) => file.type.startsWith('image/'));
        if (!file || disabled || !upload.canUpload) return false;
        event.preventDefault(); insertRef.current(file); return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), plainTextFromHtml(e.getHTML())),
  });

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor || disabled || !upload.canUpload || upload.pending) return;
      try {
        let count = 0;
        editor.state.doc.descendants((node) => { if (node.type.name === 'image') count += 1; });
        if (count >= MAX_CONTENT_IMAGES) throw new Error('A field can contain up to 20 images.');
        const uploaded = await upload.upload(file);
        if (editor.isDestroyed || !editor.isEditable) return;
        const url = filePath(uploaded.fileId);
        editor
          .chain()
          .focus()
          .setTextSelection(editor.state.selection.to)
          .setImage({ src: url, alt: uploaded.name, "data-file-id": uploaded.fileId } as {
            src: string;
            alt: string;
          })
          .run();
        onAttach?.({ fileId: uploaded.fileId, url, name: uploaded.name });
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not upload image", "error");
      }
    },
    [editor, onAttach, disabled, upload],
  );

  insertRef.current = (file) => { void insertImage(file); };
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);

  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void insertImage(file);
      e.target.value = "";
    },
    [insertImage],
  );

  useEffect(() => {
    if (editor) onReady?.({ insertImageFile: (file) => void insertImage(file) });
  }, [editor, onReady, insertImage]);

  // tiptap only reads `content` when the view is created, so a dialog that
  // stays mounted between creates kept the previous body (RFI-3 was saved with
  // RFI-2's question) and an edit form opened empty over saved text. Mirror an
  // *external* change of `value` into the editor; typing is ignored because
  // onUpdate has already pushed the same HTML upwards.
  useEffect(() => {
    if (!editor) return;
    if (isSameDoc(editor.getHTML(), value)) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  // Refresh each embedded image's src from its stable data-file-id. Presigned
  // S3 URLs expire, so the stored HTML keeps only the id and we fetch a live
  // URL on load. The src is set on the DOM node directly (not via an editor
  // transaction) so re-resolving never marks the content dirty.
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    const root = editor.view.dom as HTMLElement;
    const images = Array.from(
      root.querySelectorAll<HTMLImageElement>("img[data-file-id]"),
    );
    for (const img of images) {
      const fileId = img.getAttribute("data-file-id");
      img.removeAttribute("src");
      if (!fileId || !upload.ready) continue;
      void filesApi.resolveUrl(fileId)
        .then((url) => {
          if (!cancelled) img.src = url;
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
      for (const img of images) img.removeAttribute("src");
    };
  }, [editor, value, upload.key, upload.ready]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-line-hair bg-white" data-content-upload-pending={upload.pending || undefined}>
      <div className="flex flex-wrap items-center gap-1 border-b border-line-hair px-2 py-1.5">
        <ToolbarButton disabled={disabled} label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton disabled={disabled} label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton disabled={disabled} label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </ToolbarButton>
        <ToolbarButton disabled={disabled} label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-100" />
        {upload.canUpload ? <ToolbarButton disabled={disabled || upload.pending} label="Attach image" onClick={() => fileInputRef.current?.click()}>
          {upload.pending ? <Spinner size="xs" /> : <ImagePlus size={16} />}
        </ToolbarButton> : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          disabled={disabled || upload.pending || !upload.canUpload}
          className="hidden"
          onChange={onPickFile}
        />
      </div>
      {upload.pending ? <p role="status" className="px-3 py-1 text-xs text-ink-muted">Uploading image. Wait before saving.</p> : null}
      {upload.error ? <p role="alert" className="px-3 py-1 text-xs text-red-600">{upload.error}</p> : null}
      {!disabled ? <div className="flex flex-wrap gap-2 px-3">
        {embeddedImages(value).map((image, index) => <button key={`${image.fileId}:${index}`} type="button" className="min-h-9 rounded px-2 text-xs text-ink-muted hover:bg-gray-50" aria-label={`Remove ${image.name}`} onClick={() => {
          const positions: { from: number; to: number }[] = [];
          editor.state.doc.descendants((node, position) => {
            if (node.type.name === 'image' && node.attrs['data-file-id'] === image.fileId) positions.push({ from: position, to: position + node.nodeSize });
          });
          const transaction = editor.state.tr;
          positions.reverse().forEach(({ from, to }) => transaction.delete(from, to));
          editor.view.dispatch(transaction);
        }}>Remove {image.name}</button>)}
      </div> : null}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 text-base lg:text-sm [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:max-h-[40vh] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:outline-none [&_img]:max-h-64 [&_img]:rounded"
      />
    </div>
  );
}

RichTextEditor.displayName = "RichTextEditor";
