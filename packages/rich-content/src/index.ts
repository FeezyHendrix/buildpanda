/** Portable references, never signed URLs or image bytes in a record's text. */
export * from './audio';
export interface ContentImage { fileId: string; name: string }
export type ContentPart = { type: 'text'; text: string } | { type: 'image'; image: ContentImage };

export const FILE_ID = /^[a-zA-Z0-9_-]{1,160}$/;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_CONTENT_IMAGES = 20;

export function imageError(type: string, size: number): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) return 'Choose a JPEG, PNG, WebP, GIF, or AVIF image.';
  if (size > MAX_IMAGE_BYTES) return 'Choose an image smaller than 25 MB.';
  if (!Number.isFinite(size) || size <= 0) return 'This image is empty. Choose another file.';
  return null;
}

export const filePath = (fileId: string): string => `/files/${encodeURIComponent(fileId)}/download`;
export function fileIdFromPath(path: string): string | null {
  return /^\/files\/([a-zA-Z0-9_-]{1,160})\/download$/.exec(path)?.[1] ?? null;
}
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function imageHtml(image: ContentImage): string {
  if (!FILE_ID.test(image.fileId)) throw new Error('Invalid image reference.');
  return `<img data-file-id="${image.fileId}" src="${filePath(image.fileId)}" alt="${escapeHtml(image.name)}">`;
}

// Plain fields retain their wire format. The standard Markdown image syntax is
// also legible in notifications/exports and is understood by both clients.
const imagePattern = () => /!\[([^\]\r\n]*)\]\(\/files\/([a-zA-Z0-9_-]{1,160})\/download\)/g;
export function contentParts(value: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let start = 0;
  for (const match of value.matchAll(imagePattern())) {
    if (match.index > start) parts.push({ type: 'text', text: value.slice(start, match.index) });
    parts.push({ type: 'image', image: { fileId: match[2]!, name: match[1] || 'Image' } });
    start = match.index + match[0].length;
  }
  if (start < value.length) parts.push({ type: 'text', text: value.slice(start) });
  return parts;
}
export function appendImage(value: string, image: ContentImage): string {
  if (!FILE_ID.test(image.fileId)) throw new Error('Invalid image reference.');
  if (contentParts(value).filter((part) => part.type === 'image').length >= MAX_CONTENT_IMAGES) throw new Error('A field can contain up to 20 images.');
  const name = image.name.replace(/[\[\]\r\n]/g, ' ');
  return `${value}${value ? '\n\n' : ''}![${name}](${filePath(image.fileId)})`;
}
export function removeImage(value: string, fileId: string): string {
  return value.replace(imagePattern(), (match, _name: string, id: string) => id === fileId ? '' : match).trimEnd();
}
export function textWithoutImages(value: string): string {
  // Strips each reference with the blank-line separator appendImage put before
  // it — never the user's own trailing whitespace. This feeds controlled
  // inputs on every keystroke, so a trimEnd here eats the space being typed.
  return value.replace(/\n{0,2}!\[(?:[^\]\r\n]*)\]\(\/files\/[a-zA-Z0-9_-]{1,160}\/download\)/g, '');
}
export function textWithImages(text: string, previous: string): string {
  return contentParts(previous).reduce((result, part) => part.type === 'image' ? appendImage(result, part.image) : result, text);
}
export function contentText(value: string): string {
  return value.replace(imagePattern(), (_match, name: string) => `[Image: ${name || 'Image'}]`);
}
export function hasRichContent(html: string): boolean {
  return /<img\b[^>]*\bdata-file-id=["'][a-zA-Z0-9_-]{1,160}["']/i.test(html) ||
    html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|\s/gi, '').length > 0;
}
export function embeddedImages(value: string): ContentImage[] {
  const images = contentParts(value).flatMap((part) => part.type === 'image' ? [part.image] : []);
  for (const match of value.matchAll(/<img\b[^>]*>/gi)) {
    const id = /\bdata-file-id=["']([a-zA-Z0-9_-]{1,160})["']/i.exec(match[0])?.[1] ??
      fileIdFromPath(/\bsrc=["']([^"']*)["']/i.exec(match[0])?.[1] ?? '');
    if (id) images.push({ fileId: id, name: /\balt=["']([^"']*)["']/i.exec(match[0])?.[1] ?? 'Image' });
  }
  return images;
}
export function plainTextFromHtml(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const name = /\balt=["']([^"']*)["']/i.exec(tag)?.[1] ?? 'Image';
    return ` [Image: ${name || 'Image'}] `;
  }).replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&')
    .replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[\t ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function htmlFromText(text: string): string {
  return contentParts(text).map((part) => part.type === 'image' ? imageHtml(part.image) :
    `<p>${escapeHtml(part.text).replace(/\n/g, '<br>')}</p>`).join('');
}

/** Used before a record is written, including nested template answers. */
export function referencedFileIds(body: unknown): string[] {
  const ids = new Set<string>();
  function visit(value: unknown, key = '') {
    if (typeof value === 'string') {
      if (/^(?:fileIds?|file_ids?)$|(?:FileIds?|_file_ids?)$/.test(key) && FILE_ID.test(value)) ids.add(value);
      for (const match of value.matchAll(/\/files\/([a-zA-Z0-9_-]{1,160})(?=\/|[?"'<>\s]|$)/g)) ids.add(match[1]!);
      for (const match of value.matchAll(/\bdata-file-id\s*=\s*["']([a-zA-Z0-9_-]{1,160})["']/gi)) ids.add(match[1]!);
    } else if (Array.isArray(value)) value.forEach((entry) => visit(entry, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([name, entry]) => visit(entry, name));
  }
  visit(body);
  return [...ids];
}
