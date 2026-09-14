// Seeds a rich text editor for records written before it existed: without this
// they open blank and saving erases the original text.
export function htmlFromPlainText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped ? `<p>${escaped.replace(/\n/g, "<br>")}</p>` : "";
}
