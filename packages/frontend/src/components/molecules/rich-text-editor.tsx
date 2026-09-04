import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadFileRequest, resolveFileUrl } from "@/hooks/use-files";
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

// Persist only the stable file id on the image node, never the src. The src is
// a short-lived S3 presigned URL resolved from data-file-id at render time, so
// serialized HTML must omit it — otherwise saved content would bake an expiring
// link. renderHTML drops src whenever a data-file-id is present.
const FileImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-file-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-file-id"),
        renderHTML: (attrs) =>
          attrs["data-file-id"] ? { "data-file-id": attrs["data-file-id"] } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }, { tag: "img[data-file-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    if (HTMLAttributes["data-file-id"]) {
      const { src: _src, ...rest } = HTMLAttributes;
      return ["img", rest];
    }
    return ["img", HTMLAttributes];
  },
});

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm",
        active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, onAttach, projectId, onReady, placeholder, disabled, ariaLabel }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    editorProps: ariaLabel ? { attributes: { "aria-label": ariaLabel } } : undefined,
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), e.getText()),
  });

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const uploaded = await uploadFileRequest(file, undefined, projectId);
        const url = await resolveFileUrl(uploaded.id);
        editor
          .chain()
          .focus()
          .setImage({ src: url, alt: uploaded.fileName, "data-file-id": uploaded.id } as {
            src: string;
            alt: string;
          })
          .run();
        onAttach?.({ fileId: uploaded.id, url, name: uploaded.fileName });
      } catch {
        toast("Could not upload image", "error");
      }
    },
    [editor, onAttach, projectId],
  );

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
      if (!fileId) continue;
      void resolveFileUrl(fileId)
        .then((url) => {
          if (!cancelled) img.src = url;
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-[#EDEDED] bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#F0F0F0] px-2 py-1.5">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[#F0F0F0]" />
        <ToolbarButton label="Attach image" onClick={() => fileInputRef.current?.click()}>
          🖼
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 text-base lg:text-sm [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:max-h-[40vh] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:outline-none [&_img]:max-h-64 [&_img]:rounded"
      />
    </div>
  );
}

RichTextEditor.displayName = "RichTextEditor";
