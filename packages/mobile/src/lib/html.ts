/**
 * Rough HTML → plain text for the searchable / plain-text mirror stored alongside
 * a rich field. Block-level tags become spaces so words don't run together; this
 * is not a sanitiser and is never rendered as HTML.
 */
export { plainTextFromHtml as htmlToText } from "@buildpanda/rich-content";

export { htmlFromText as textToParagraphHtml } from '@buildpanda/rich-content';

export interface HtmlAttachment {
  readonly fileId: string;
  readonly fileName: string;
  readonly mimeType: string;
}

export function appendHtmlAttachment(html: string, attachment: HtmlAttachment): string {
  const safeName = attachment.fileName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const url = `/files/${attachment.fileId}/download`;
  const node = attachment.mimeType.startsWith("image/")
    ? `<img data-file-id="${attachment.fileId}" src="${url}" alt="${safeName}" />`
    : `<a data-file-id="${attachment.fileId}" href="${url}">${safeName}</a>`;
  return html.trim() ? `${html}${node}` : `<p>${node}</p>`;
}
