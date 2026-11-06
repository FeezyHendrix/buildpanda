import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadFileRequest, resolveFileUrl } from "@/hooks/use-files";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";

export interface UploadedAttachment {
  fileId: string;
  url: string;
  name: string;
}

export interface RichTextEditorHandle {
  insertImageFile: (file: File) => Promise<void>;
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
  /**
   * `panel` is the flat comment box used in side panels: a 30px grey toolbar with
   * the numbered list before the bullets, and room for a `footer` action inside
   * the box. `default` is unchanged.
   */
  variant?: "default" | "panel";
  /** Rendered inside the box, bottom right, in the `panel` variant (e.g. the submit button). */
  footer?: ReactNode;
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
          attrs["data-file-id"]
            ? { "data-file-id": attrs["data-file-id"] }
            : {},
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
  panel = false,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  panel?: boolean;
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
        panel
          ? "flex h-[30px] w-[32px] items-center justify-center text-sm"
          : "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm",
        active
          ? panel ? "bg-[#E4E4E4] text-gray-900" : "bg-grey-100 text-gray-900"
          : panel ? "text-[#1E1E1E] hover:bg-[#E8E8E8]" : "text-gray-600 hover:bg-grey-100",
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onAttach,
  projectId,
  onReady,
  placeholder,
  disabled,
  ariaLabel,
  variant = "default",
  footer,
}: Props) {
  const panel = variant === "panel";
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      FileImage.configure({ inline: false }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write a response…",
        // A read-only box still says what it is for.
        showOnlyWhenEditable: false,
      }),
    ],
    content: value,
    editable: !disabled,
    // never undefined: tiptap reads editorProps.dispatchTransaction without a guard
    editorProps: ariaLabel ? { attributes: { "aria-label": ariaLabel } } : {},
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
          .setImage({
            src: url,
            alt: uploaded.fileName,
            "data-file-id": uploaded.id,
          } as {
            src: string;
            alt: string;
          })
          .createParagraphNear()
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
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      void (async () => {
        for (const file of files) await insertImage(file);
      })();
    },
    [insertImage],
  );

  useEffect(() => {
    if (editor) onReady?.({ insertImageFile: (file) => insertImage(file) });
  }, [editor, onReady, insertImage]);

  // Keep editor in sync when `value` changes externally (e.g. mention autocomplete).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    // Normalize empty
    const next = value || "<p></p>";
    if (current !== value && current !== next) {
      // Use setContent without adding to history so caret stays reasonable
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

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

  const lists = [
    <ToolbarButton
      key="ordered"
      panel={panel}
      label="Numbered list"
      active={editor.isActive("orderedList")}
      onClick={() => editor.chain().focus().toggleOrderedList().run()}
    >
      <ReactSVG src={icons2.orderedList} />
    </ToolbarButton>,
    <ToolbarButton
      key="bullet"
      panel={panel}
      label="Bullet list"
      active={editor.isActive("bulletList")}
      onClick={() => editor.chain().focus().toggleBulletList().run()}
    >
      <ReactSVG src={icons2.unorderedList} />
    </ToolbarButton>,
  ];
  // The default editor lists bullets first; the panel lists numbers first.
  const orderedLists = panel ? lists : [lists[1], lists[0]];
  const divider = <div className={cn("self-stretch bg-[#0000001F]", panel ? "mx-[5px] w-px" : "-my-1.5 w-px")} />;

  return (
    <div className={cn("bg-white", panel ? "flex min-h-[206px] flex-col border border-[#EEEEEE]" : "border-[0.5px] border-border")}>
      <div
        className={cn(
          "flex items-center",
          panel
            ? "h-[31px] shrink-0 border-b border-[#E6E6E6] bg-[#F0F0F0] pl-[10px]"
            : "flex-wrap gap-1 border-b-[0.5px] border-border bg-grey-50 px-2 py-1.5",
        )}
      >
        <ToolbarButton
          panel={panel}
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <ReactSVG src={icons2.bold} />
        </ToolbarButton>
        <ToolbarButton
          panel={panel}
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ReactSVG src={icons2.italic} />
        </ToolbarButton>
        <ToolbarButton
          panel={panel}
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <ReactSVG src={icons2.strikethrough} />
        </ToolbarButton>
        {divider}
        {orderedLists}
        {divider}
        <ToolbarButton
          panel={panel}
          label="Attach image"
          onClick={() => fileInputRef.current?.click()}
        >
          <ReactSVG src={icons2.image} />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPickFile}
        />
      </div>
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm max-w-none text-base lg:text-sm [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:outline-none [&_img]:max-h-64 [&_img]:rounded [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
          panel
            ? "flex-1 px-[24px] pt-[18px] text-[14px] [&_.ProseMirror]:min-h-[96px] [&_.ProseMirror]:max-h-[30vh] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#A5A5A5]"
            : "px-3 py-2 [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:max-h-[40vh] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400",
        )}
      />
      {panel && footer ? <div className="flex justify-end px-[8px] pb-[7px]">{footer}</div> : null}
    </div>
  );
}

RichTextEditor.displayName = "RichTextEditor";
