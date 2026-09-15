/** These formats are supported by the shared annotation canvas. */
export function isReviewableFile(fileName: string): boolean {
  return /\.(pdf|png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}
