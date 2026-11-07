/** Expo includes the HTTP status in its native download exception, but no response body. */
export function downloadError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  const status = Number(message.match(/response has status (\d{3})/i)?.[1]);
  if (status === 404) return new Error("This file is missing from storage. Ask the uploader to upload it again.");
  if (status === 401) return new Error("Your session has expired. Sign in again to download this file.");
  if (status === 403) return new Error("You don't have permission to download this file.");
  if (status >= 500) return new Error("The server couldn't provide this file. Try again shortly.");
  return new Error("Couldn't download this file. Check your connection and try again.");
}
