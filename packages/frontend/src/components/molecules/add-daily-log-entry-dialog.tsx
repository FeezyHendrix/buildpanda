import { useEffect, useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Button } from "@/components/atoms/button";
import { FormDialog } from "@/components/molecules/form-dialog";
import { RichTextField } from "@/components/molecules/rich-text-field";
import type { RichTextEditorHandle } from "@/components/molecules/rich-text-editor";
import { cn } from "@/lib/utils";

interface AddDailyLogEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logDate: string;
  projectId: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (bodyHtml: string, bodyText: string) => void;
}

export function AddDailyLogEntryDialog({
  open,
  onOpenChange,
  logDate,
  projectId,
  submitting,
  error,
  onSubmit,
}: AddDailyLogEntryDialogProps) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const editorRef = useRef<RichTextEditorHandle | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setHtml("");
      setText("");
    }
  }, [open]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) editorRef.current?.insertImageFile(file);
    e.target.value = "";
  }

  const hasContent = text.trim().length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add your log — ${logDate}`}
      description="Record what you did on site today. Attach photos from your camera or files. Your name and role are saved with the entry."
      submitLabel="Add entry"
      submitDisabled={!hasContent}
      submitting={submitting}
      error={error}
      onSubmit={() => onSubmit(html, text)}
      className="w-[min(720px,calc(100vw-2rem))]"
    >
      <RichTextField
        label="What did you do today?"
        value={html}
        onChange={setHtml}
        onChangeText={setText}
        projectId={projectId}
        onReady={(handle) => (editorRef.current = handle)}
        placeholder="e.g. Completed the level 3 slab pour, inspected rebar, flagged a delivery delay…"
      />

      <Menu.Root>
        <Menu.Trigger render={<Button type="button" variant="secondary" size="md" className="w-fit" />}>
          <svg className="size-4 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          Attach image
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="top" align="start" sideOffset={6} className="z-[60]">
            <Menu.Popup className="min-w-48 rounded-lg border border-line bg-white p-1 shadow-card outline-none">
              <Menu.Item
                className={cn(
                  "flex cursor-default select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink",
                  "outline-none data-[highlighted]:bg-surface-alt data-[highlighted]:text-ink",
                )}
                onClick={() => cameraInputRef.current?.click()}
              >
                <svg className="size-4 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                Take photo
              </Menu.Item>
              <Menu.Item
                className={cn(
                  "flex cursor-default select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink",
                  "outline-none data-[highlighted]:bg-surface-alt data-[highlighted]:text-ink",
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="size-4 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                Choose file
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePick}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
    </FormDialog>
  );
}
