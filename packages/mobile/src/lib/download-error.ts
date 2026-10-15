/** Expo includes the HTTP status in its native download exception, but no response body. */
export function downloadError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  // Native expo-file-system has changed its wording between SDK releases
  // ("response has status 404", "response status: 404", and
  // "request failed with status 404"). Keep the server's actionable status
  // instead of mislabelling a missing source file as a connectivity problem.
  const status = Number(message.match(/(?:response|request)(?:\s+has|\s+failed\s+with)?\s+status\s*:?[\s]+(\d{3})/i)?.[1]);
  if (status === 404) return new Error("This file is missing from storage. Ask the uploader to upload it again.");
  if (status === 401) return new Error("Your session has expired. Sign in again to download this file.");
  if (status === 403) return new Error("You don't have permission to download this file.");
  if (status >= 500) return new Error("The server couldn't provide this file. Try again shortly.");
  return new Error("Couldn't download this file. Check your connection and try again.");
}
