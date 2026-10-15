import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DecoratorNode, $getNodeByKey, type DOMConversionMap, type DOMExportOutput, type NodeKey, type SerializedLexicalNode } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { FILE_ID, fileIdFromPath, filePath } from '@buildpanda/rich-content';

export const ImageResolver = createContext<{ resolve: (fileId: string) => Promise<string>; version: string; open?: (fileId: string, name: string) => Promise<void> }>({ resolve: async () => '', version: '' });
interface SerializedImage extends SerializedLexicalNode { fileId: string; name: string }

function ImageView({ fileId, name, nodeKey }: { fileId: string; name: string; nodeKey: NodeKey }) {
  const { resolve, version, open } = useContext(ImageResolver);
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const [result, setResult] = useState({ key: '', url: '', error: '' });
  useEffect(() => {
    let active = true;
    setResult({ key: version, url: '', error: '' });
    resolve(fileId).then((url) => { if (active) setResult({ key: version, url, error: '' }); })
      .catch((error: unknown) => { if (active) setResult({ key: version, url: '', error: error instanceof Error ? error.message : 'Image unavailable.' }); });
    return () => { active = false; };
  }, [fileId, resolve, version]);
  return <span className="rt-image" contentEditable={false}>
    {result.key === version && result.url ? <img src={result.url} alt={name} role={open ? "button" : undefined} tabIndex={open ? 0 : undefined} onClick={() => { void open?.(fileId, name); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void open?.(fileId, name); } }} /> : <span role="status">{result.error || `Loading ${name}…`}</span>}
    {editable ? <button type="button" aria-label={`Remove ${name}`} onClick={() => editor.update(() => $getNodeByKey(nodeKey)?.remove())}>Remove image</button> : null}
  </span>;
}

/** Lexical needs an explicit node to retain images through import/edit/export. */
export class FileImageNode extends DecoratorNode<ReactNode> {
  __fileId: string;
  __name: string;
  static getType() { return 'file-image'; }
  static clone(node: FileImageNode) { return new FileImageNode(node.__fileId, node.__name, node.__key); }
  constructor(fileId: string, name: string, key?: NodeKey) { super(key); this.__fileId = fileId; this.__name = name; }
  static importJSON(value: SerializedLexicalNode & Record<string, unknown>) {
    if (typeof value.fileId !== 'string' || !FILE_ID.test(value.fileId)) throw new Error('Invalid image reference.');
    return new FileImageNode(value.fileId, typeof value.name === 'string' ? value.name : 'Image');
  }
  exportJSON(): SerializedImage { return { ...super.exportJSON(), type: 'file-image', version: 1, fileId: this.__fileId, name: this.__name }; }
  static importDOM(): DOMConversionMap {
    return { img: (element) => {
      const id = element.getAttribute('data-file-id') ?? fileIdFromPath(element.getAttribute('src') ?? '');
      return id && FILE_ID.test(id) ? { priority: 2, conversion: () => ({ node: new FileImageNode(id, element.getAttribute('alt') || 'Image') }) } : null;
    } };
  }
  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('data-file-id', this.__fileId);
    element.setAttribute('src', filePath(this.__fileId));
    element.setAttribute('alt', this.__name);
    return { element };
  }
  createDOM() { const element = document.createElement('span'); element.className = 'rt-image-node'; return element; }
  updateDOM() { return false; }
  isInline() { return false; }
  decorate() { return <ImageView fileId={this.__fileId} name={this.__name} nodeKey={this.__key} />; }
}
