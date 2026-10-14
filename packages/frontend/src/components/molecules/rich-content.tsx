import { createElement, useMemo, type ReactNode, type Ref } from "react";
import { contentParts, FILE_ID, fileIdFromPath } from "@buildpanda/rich-content";
import { ContentImage, ContentFileLink } from "./content-image";
import { cn } from "@/lib/utils";

const TAGS = new Set(['p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4']);
const OMIT = new Set(['script', 'style', 'iframe', 'object', 'embed']);

/** Plain text stays text; only canonical, authorized file references become images. */
export function ContentText({ value, projectId, className }: { value?: string | null; projectId?: string; className?: string }) {
  return <span className={cn('whitespace-pre-wrap', className)}>{contentParts(value ?? '').map((part, index) => part.type === 'text' ? part.text :
    <ContentImage key={`${part.image.fileId}:${index}`} image={part.image} projectId={projectId} />)}</span>;
}
ContentText.displayName = 'ContentText';

function readNode(node: Node, key: string, projectId?: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return <ContentText key={key} value={node.textContent} projectId={projectId} />;
  if (!(node instanceof HTMLElement)) return null;
  const tag = node.tagName.toLowerCase();
  if (OMIT.has(tag)) return null;
  const children = Array.from(node.childNodes).map((child, index) => readNode(child, `${key}:${index}`, projectId));
  if (tag === 'img') {
    const fileId = node.getAttribute('data-file-id') ?? fileIdFromPath(node.getAttribute('src') ?? '');
    return fileId && FILE_ID.test(fileId) ? <ContentImage key={key} image={{ fileId, name: node.getAttribute('alt') || 'Image' }} projectId={projectId} /> : null;
  }
  if (tag === 'a') {
    const href = node.getAttribute('href') ?? '';
    const fileId = fileIdFromPath(href);
    if (fileId) return <ContentFileLink key={key} fileId={fileId} projectId={projectId}>{children}</ContentFileLink>;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(href)) return <span key={key}>{children}</span>;
    return <a key={key} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return TAGS.has(tag) ? createElement(tag, { key }, ...(tag === 'br' ? [] : children)) : <span key={key}>{children}</span>;
}

/** A small allowlisted renderer also protects old/offline HTML, without innerHTML. */
export function RichContent({ html, text, projectId, className, ref }: { html?: string | null; text?: string | null; projectId?: string; className?: string; ref?: Ref<HTMLDivElement> }) {
  const nodes = useMemo(() => html ? Array.from(new DOMParser().parseFromString(html, 'text/html').body.childNodes)
    .map((node, index) => readNode(node, String(index), projectId)) : null, [html, projectId]);
  return <div ref={ref} className={cn('prose prose-sm max-w-none', className)}>{nodes ?? <ContentText value={text} projectId={projectId} />}</div>;
}
RichContent.displayName = 'RichContent';
