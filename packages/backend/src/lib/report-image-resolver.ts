import type { FilesService } from "../modules/files/service.ts";
import { toPdfImageBytes } from "./report-images.ts";
import type { RichTextOptions } from "./report-richtext.ts";

export function makeReportImageResolver(files: FilesService): RichTextOptions["resolveImage"] {
  return async (fileId) => {
    const file = await files.readBytes(fileId);
    if (!file) return null;
    const image = await toPdfImageBytes(file.bytes, file.mimeType);
    if (!image) return null;
    return { bytes: image.bytes, width: image.width, height: image.height, alt: file.fileName };
  };
}
