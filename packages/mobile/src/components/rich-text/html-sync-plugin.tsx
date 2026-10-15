import { useEffect, useRef } from 'react';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $getRoot, $getSelection, $isRangeSelection, $insertNodes, $createTextNode, $createParagraphNode } from 'lexical';
import { $createLinkNode } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { filePath } from '@buildpanda/rich-content';
import { FileImageNode } from './image-node';

export interface EditorAttachment { key: string; fileId: string; fileName: string; mimeType: string }
export function HtmlSyncPlugin({ value, onChange, attachment }: { value: string; onChange: (html: string) => void; attachment?: EditorAttachment }) {
  const [editor] = useLexicalComposerContext();
  const emitted = useRef<string | null>(null);
  const inserted = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (value === emitted.current) return;
    editor.update(() => {
      const dom = new DOMParser().parseFromString(value, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot(); root.clear(); root.select();
      $insertNodes(nodes.length ? nodes : [$createParagraphNode()]);
    }, { tag: 'external-content' });
  }, [editor, value]);
  useEffect(() => {
    if (!attachment || attachment.key === inserted.current || !editor.isEditable()) return;
    inserted.current = attachment.key;
    editor.update(() => {
      if (!$getRoot().getChildrenSize()) $getRoot().append($createParagraphNode());
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        const { key, offset, type } = selection.isBackward() ? selection.anchor : selection.focus;
        selection.anchor.set(key, offset, type);
        selection.focus.set(key, offset, type);
      }
      if (attachment.mimeType.startsWith('image/')) $insertNodes([new FileImageNode(attachment.fileId, attachment.fileName)]);
      else $insertNodes([$createLinkNode(filePath(attachment.fileId)).append($createTextNode(attachment.fileName))]);
    });
  }, [editor, attachment]);
  return <OnChangePlugin ignoreSelectionChange onChange={(_state, current, tags) => {
    if (tags.has('external-content')) return;
    current.read(() => { const html = $generateHtmlFromNodes(current, null); emitted.current = html; onChange(html); });
  }} />;
}
