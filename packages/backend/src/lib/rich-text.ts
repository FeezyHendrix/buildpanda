import sanitizeHtml from "sanitize-html";
import { FILE_ID, fileIdFromPath, filePath } from "@buildpanda/rich-content";

// Matches what the editors actually emit (tiptap on web, lexical on mobile).
// Anything outside this is dropped rather than escaped: a stored note should
// render as the text someone typed, never as markup that runs.
const ALLOWED_TAGS = [
  "p", "br", "span", "strong", "b", "em", "i", "u", "s", "sub", "sup",
  "ul", "ol", "li", "blockquote", "code", "pre",
  "h1", "h2", "h3", "h4",
  "a", "img",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    // rel/target are set by the transform below, so they must be allowed here
    // or they are added and then stripped straight back off.
    a: ["href", "title", "target", "rel", "data-file-id"],
    img: ["src", "alt", "data-file-id"],
    span: ["class"],
    code: ["class"],
    pre: ["class"],
  },
  // No javascript:, no data: — those are the two that turn a link into a payload.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  // A link out of a site record opens elsewhere and must not hand over the opener.
  transformTags: {
    a: (_tag, attributes) => {
      const id = attributes["data-file-id"];
      return { tagName: "a", attribs: { ...attributes, ...(id && FILE_ID.test(id) ? { href: filePath(id) } : {}), rel: "noopener noreferrer", target: "_blank" } };
    },
    img: (_tag, attributes): sanitizeHtml.Tag => {
      const id = attributes["data-file-id"] ?? fileIdFromPath(attributes.src ?? "");
      return { tagName: "img", attribs: id && FILE_ID.test(id)
        ? { "data-file-id": id, src: filePath(id), alt: attributes.alt ?? "Image" } : {} };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs["data-file-id"],
  disallowedTagsMode: "discard",
};

/** Strips anything executable from editor HTML before it is stored. */
export function sanitizeRichText<T extends string | null | undefined>(html: T): T {
  if (typeof html !== "string") return html;
  return sanitizeHtml(html, OPTIONS) as T;
}

/**
 * Sanitises every `*Html` field in a request body, however deeply nested.
 *
 * Done centrally because the alternative is remembering it in each of the 27
 * write points across 15 modules — and the next module to add a rich-text
 * field would start out unprotected.
 */
export function sanitizeHtmlFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeHtmlFields);
  if (value === null || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    result[key] =
      key.endsWith("Html") && typeof entry === "string"
        ? sanitizeRichText(entry)
        : sanitizeHtmlFields(entry);
  }
  return result;
}
