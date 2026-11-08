import { filesApi } from "@/api/files";
import type { ChatAttachment } from "./message-attachments";

function saveBlob(blob: Blob, name: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/**
 * Last resort when the storage host will not let the page read the file: point a
 * hidden frame at the download route. It answers with `Content-Disposition:
 * attachment`, so the browser saves the file without leaving or reloading the app.
 */
function saveThroughFrame(attachment: ChatAttachment): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = attachment.url;
    document.body.appendChild(frame);
    window.setTimeout(() => {
      frame.remove();
      resolve();
    }, 3000);
  });
}

/**
 * Saves a chat attachment from inside the app. The file is fetched in the
 * background from a short-lived signed URL, then handed to the browser as a
 * download; the returned promise settles when the file has been received.
 */
export async function downloadAttachment(attachment: ChatAttachment): Promise<void> {
  let blob: Blob;
  try {
    const signedUrl = await filesApi.resolveUrl(attachment.fileId);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
    blob = await response.blob();
  } catch (error) {
    // A network/CORS refusal surfaces as a TypeError; anything else is a real failure.
    if (error instanceof TypeError) {
      await saveThroughFrame(attachment);
      return;
    }
    throw error;
  }
  saveBlob(blob, attachment.name);
}
