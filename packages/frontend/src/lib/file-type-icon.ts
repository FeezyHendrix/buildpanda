import { icons } from "@/assets/icons/icons";
import { icons2 } from "@/assets/icons2/icon2";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"]);

/** The badge icon for a file, chosen by its extension. */
export function getFileTypeIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return icons2.jpg;
  if (IMAGE_EXTS.has(ext)) return icons2.png;
  if (ext === "pdf") return icons2.pdf;
  if (ext === "xlsx" || ext === "xls") return icons2.xls;
  if (ext === "mov") return icons2.mov;
  if (ext === "txt") return icons2.txt;
  if (ext === "mp3") return icons2.mp3;
  return icons.doc;
}
