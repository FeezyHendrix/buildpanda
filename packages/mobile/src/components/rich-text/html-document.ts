import { Parser } from "htmlparser2";
import { escapeHtml, fileIdFromPath, FILE_ID, imageHtml, type ContentImage } from "@buildpanda/rich-content";

export interface EditorImage extends ContentImage { source: string; width: number; height: number }
const TAGS = new Set(["p", "div", "br", "b", "i", "u", "s", "sub", "sup", "span", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "codeblock", "pre", "ul", "ol", "li", "a"]);
const DISCARD = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template"]);
const ALIASES: Record<string, string> = { strong: "b", em: "i", strike: "s", del: "s", pre: "codeblock" };

export function safeRichTextLink(url: string): boolean {
  return !!fileIdFromPath(url) || /^(?:https?:\/\/|mailto:|tel:)[^\s<>]+$/i.test(url);
}

function reference(attributes: Record<string, string>, images: readonly EditorImage[]): ContentImage | undefined {
  const cached = images.find((image) => image.source === attributes.src);
  if (cached) return cached;
  const id = attributes["data-file-id"] ?? fileIdFromPath(attributes.src ?? "") ?? /^about:blank#([\w-]+)$/.exec(attributes.src ?? "")?.[1];
  if (!id || !FILE_ID.test(id)) return;
  return { fileId: id, name: attributes.alt || images.find((image) => image.fileId === id)?.name || "Image" };
}

/** Enriched may discard custom attributes. Restore durable IDs from our resolved
 * sources before any HTML leaves the component; never save local/signed URLs. */
export function richTextDocument(html: string, images: readonly EditorImage[] = [], display = false): string {
  let output = "";
  let discarded = 0;
  const stack: { close: string; blocked: boolean }[] = [];
  const parser = new Parser({
    onopentag(name, attributes) {
      const blocked = discarded > 0 || DISCARD.has(name);
      if (blocked) { discarded++; stack.push({ close: "", blocked: true }); return; }
      if (name === "img") {
        const image = reference(attributes, images);
        if (image) {
          const cached = images.find((entry) => entry.fileId === image.fileId);
          output += display
            ? `<img src="${escapeHtml(cached?.source ?? `about:blank#${image.fileId}`)}" width="${cached?.width ?? 240}" height="${cached?.height ?? 160}">`
            : imageHtml(image);
        }
        stack.push({ close: "", blocked: false });
        return;
      }
      const mapped = ALIASES[name] ?? name;
      const tag = !display && mapped === "codeblock" ? "pre" : mapped;
      if (!TAGS.has(tag)) { stack.push({ close: "", blocked: false }); return; }
      let attrs = "";
      if (tag === "a" && safeRichTextLink(attributes.href ?? "")) attrs = ` href="${escapeHtml(attributes.href!)}"`;
      const align = /(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i.exec(attributes.style ?? "")?.[1];
      if (align) attrs += ` style="text-align:${align.toLowerCase()}"`;
      // Lexical's older output may put inline formatting on spans.
      const style = attributes.style ?? "";
      const marks = tag === "span" ? [
        /font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style) ? "b" : "",
        /font-style\s*:\s*italic/i.test(style) ? "i" : "",
        /text-decoration[^:]*\s*:[^;]*underline/i.test(style) ? "u" : "",
      ].filter(Boolean) : [];
      output += `<${tag}${attrs}>` + marks.map((mark) => `<${mark}>`).join("");
      stack.push({ close: marks.reverse().map((mark) => `</${mark}>`).join("") + (tag === "br" ? "" : `</${tag}>`), blocked: false });
    },
    ontext(text) { if (!discarded) output += escapeHtml(text); },
    onclosetag() {
      const item = stack.pop();
      if (item?.blocked) discarded--;
      else output += item?.close ?? "";
    },
  }, { decodeEntities: true });
  parser.end(html);
  return output;
}

export function imageSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { width: 240, height: 160 };
  const scale = Math.min(1, 280 / width, 240 / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
