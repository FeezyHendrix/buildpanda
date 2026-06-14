import { useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadFileRequest } from "@/hooks/use-files";
import { cn } from "@/lib/utils";

export interface UploadedAttachment {
  fileId: string;
  url: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (html: string, text: string) => void;
  onAttach?: (attachment: UploadedAttachment) => void;
  placeholder?: string;
  disabled?: boolean;
}

function fileUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${base}/files/${fileId}/download`;
}

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

export function RichTextEditor({ value, onChange, onAttach, placeholder, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Write a response…" }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), e.getText()),
  });

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const uploaded = await uploadFileRequest(file);
        const url = fileUrl(uploaded.id);
        editor.chain().focus().setImage({ src: url, alt: uploaded.fileName }).run();
        onAttach?.({ fileId: uploaded.id, url, name: uploaded.fileName });
      } catch {
        void 0;
      }
    },
    [editor, onAttach],
  );

  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void insertImage(file);
      e.target.value = "";
    },
    [insertImage],
  );

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
        className="prose prose-sm max-w-none px-3 py-2 text-sm [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_img]:max-h-64 [&_img]:rounded"
      />
    </div>
  );
}

RichTextEditor.displayName = "RichTextEditor";
