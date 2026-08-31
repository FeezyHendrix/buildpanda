"use dom";

import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
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
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, $insertNodes, FORMAT_TEXT_COMMAND, type EditorState, type LexicalEditor } from "lexical";
import { useEffect, useRef } from "react";

const THEME = {
  paragraph: "rt-p",
  text: { bold: "rt-bold", italic: "rt-italic" },
  list: { ul: "rt-ul", ol: "rt-ol", listitem: "rt-li" },
};

const STYLES = `
  .rt-shell { font-family: -apple-system, system-ui, sans-serif; }
  .rt-toolbar { display:flex; gap:6px; padding:8px; border-bottom:1px solid #EDEDED; position:sticky; top:0; background:#fff; z-index:1; }
  .rt-toolbar button { border:1px solid #EDEDED; background:#fff; border-radius:8px; min-width:38px; height:38px; font-size:16px; color:#1A1A1A; }
  .rt-toolbar button:active { background:#F6F6F6; }
  .rt-input { min-height:150px; padding:12px; outline:none; font-size:16px; line-height:1.5; color:#1A1A1A; }
  .rt-input:empty:before { content: attr(data-placeholder); color:#ADADAD; }
  .rt-bold { font-weight:700; }
  .rt-italic { font-style:italic; }
  .rt-ul, .rt-ol { padding-left:22px; margin:6px 0; }
`;

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      // Keep the editor selection: prevent the toolbar from stealing focus on press.
      onMouseDown={(event) => {
        event.preventDefault();
        onPress();
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
      <Btn label="B" onPress={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} />
      <Btn label="I" onPress={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} />
      <Btn label="•" onPress={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} />
      <Btn label="1." onPress={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} />
    </div>
  );
}

function InitialHtml({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !html) return;
    done.current = true;
    editor.update(() => {
      const dom = new DOMParser().parseFromString(html, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      root.select();
      $insertNodes(nodes);
    });
  }, [editor, html]);
  return null;
}

export default function Editor({
  value,
  onChangeHtml,
  placeholder = "Write here…",
}: {
  value: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
  dom?: import("expo/dom").DOMProps;
}) {
  return (
    <div className="rt-shell">
      <style>{STYLES}</style>
      <LexicalComposer
        initialConfig={{
          namespace: "field-notes",
          theme: THEME,
          nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
          onError: (error: Error) => console.error(error),
        }}
      >
        <Toolbar />
        <RichTextPlugin
          contentEditable={<ContentEditable className="rt-input" data-placeholder={placeholder} />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <InitialHtml html={value} />
        <OnChangePlugin
          onChange={(_state: EditorState, editor: LexicalEditor) =>
            editor.read(() => onChangeHtml($generateHtmlFromNodes(editor, null)))
          }
        />
      </LexicalComposer>
    </div>
  );
}
