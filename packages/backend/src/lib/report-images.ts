import sharp from "sharp";

const MAX_DIMENSION = 1400;

export interface PdfImage {
  bytes: Buffer;
  width: number;
  height: number;
}

export async function toPdfImageBytes(input: Buffer, mimeType: string): Promise<PdfImage | null> {
  const lower = mimeType.toLowerCase();
  if (!lower.startsWith("image/")) return null;
  try {
    const pipeline = sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .png();
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}
