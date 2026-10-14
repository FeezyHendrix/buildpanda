"use dom";

import { LinkNode } from "@lexical/link";
import { fileIdFromPath } from "@buildpanda/rich-content";
import { FileImageNode, ImageResolver } from "./image-node";
import { HtmlSyncPlugin, type EditorAttachment } from "./html-sync-plugin";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { FORMAT_TEXT_COMMAND } from "lexical";

import { palette } from "@/constants/colors";

const THEME = {
  paragraph: "rt-p",
  text: { bold: "rt-bold", italic: "rt-italic" },
  list: { ul: "rt-ul", ol: "rt-ol", listitem: "rt-li" },
};

// Toolbar buttons are 44px: the same gloved-hand floor as every other target.
const STYLES = `
  .rt-shell { font-family: -apple-system, system-ui, sans-serif; }
  .rt-toolbar { display:flex; gap:6px; padding:8px; border-bottom:1px solid ${palette.grey50}; position:sticky; top:0; background:${palette.surface}; z-index:1; }
  .rt-toolbar button { border:1px solid ${palette.grey50}; background:${palette.surface}; border-radius:8px; min-width:44px; height:44px; font-size:16px; color:${palette.black500}; }
  .rt-toolbar button:active { background:${palette.surfaceAlt}; }
  .rt-input { min-height:150px; padding:12px; outline:none; font-size:16px; line-height:1.5; color:${palette.black500}; }
  .rt-input:empty:before { content: attr(data-placeholder); color:${palette.grey200}; }
  .rt-readonly .rt-input { min-height:0; padding:0; }
  .rt-image { display:flex; flex-direction:column; gap:8px; margin:8px 0; }
  .rt-image img { max-width:100%; max-height:320px; object-fit:contain; border-radius:8px; align-self:flex-start; }
  .rt-image button { min-height:44px; align-self:flex-start; border:0; border-radius:8px; padding:8px 12px; color:${palette.black500}; background:${palette.surfaceAlt}; }
  .rt-bold { font-weight:700; }
  .rt-italic { font-style:italic; }
  .rt-ul, .rt-ol { padding-left:22px; margin:6px 0; }
  .rt-compact .rt-input { min-height:72px; max-height:140px; overflow-y:auto; }
`;

function Btn({ label, name, onPress }: { label: string; name: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={name}
      onClick={onPress}
      // Keep the editor selection: prevent the toolbar from stealing focus on press.
      onMouseDown={(event) => {
        event.preventDefault();

      }}
    >
      {label}
    </button>
  );
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  return (
    <div className="rt-toolbar">
      <Btn label="B" name="Bold" onPress={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} />
      <Btn label="I" name="Italic" onPress={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} />
      <Btn label="•" name="Bullet list" onPress={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} />
      <Btn label="1." name="Numbered list" onPress={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} />
    </div>
  );
}

export default function Editor({
  value,
  onChangeHtml,
  placeholder = "Write here…",
  label,
  compact = false,
  readOnly = false,
  resolveImage,
  onOpenImage,
  onOpenFile,
  accessVersion = "",
  attachment,
}: {
  readOnly?: boolean;
  resolveImage: (fileId: string) => Promise<string>;
  onOpenImage?: (fileId: string, name: string) => Promise<void>;
  onOpenFile?: (fileId: string) => Promise<void>;
  accessVersion?: string;
  attachment?: EditorAttachment;
  value: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
  label?: string;
  /** Short and capped, scrolling inside itself: for a composer pinned above the keyboard. */
  compact?: boolean;
  dom?: import("expo/dom").DOMProps;
}) {
  return (
    <ImageResolver.Provider value={{ resolve: resolveImage, version: accessVersion, open: onOpenImage }}>
    <div className={`rt-shell${compact ? " rt-compact" : ""}${readOnly ? " rt-readonly" : ""}`}
      onClick={(event) => {
        const link = event.target instanceof Element ? event.target.closest('a') : null;
        const fileId = fileIdFromPath(link?.getAttribute('href') ?? '');
        if (fileId) { event.preventDefault(); event.stopPropagation(); void onOpenFile?.(fileId); }
      }}>
      <style>{STYLES}</style>
      <LexicalComposer
        initialConfig={{
          namespace: "field-notes",
          theme: THEME,
          nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, FileImageNode],
          editable: !readOnly,
          onError: (error: Error) => console.error(error),
        }}
      >
        {!readOnly ? <Toolbar /> : null}
        <RichTextPlugin
          contentEditable={<ContentEditable className="rt-input" aria-label={label ?? placeholder} data-placeholder={placeholder} />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <HtmlSyncPlugin value={value} onChange={onChangeHtml} attachment={attachment} />
      </LexicalComposer>
    </div>
    </ImageResolver.Provider>
  );
}
