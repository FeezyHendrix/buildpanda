import { Directory, File, Paths } from "expo-file-system";

// Media that is waiting to be uploaded must outlive the wait. A recording made
// in a basement can sit for hours before there is signal, and the OS reclaims
// the cache directory under storage pressure, so staged media goes in the
// document directory beside the offline plan cache.

const STAGE_DIR_NAME = "outbox-media";

function stageDir(): Directory {
  const dir = new Directory(Paths.document, STAGE_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function extensionOf(fileName: string): string {
  return fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
}

/** Copies a recording somewhere durable and returns the path to push from later. */
export function stageMedia(sourceUri: string, id: string, fileName: string): string {
  const destination = new File(stageDir(), `${id}${extensionOf(fileName)}`);
  if (destination.exists) destination.delete();
  new File(sourceUri).copy(destination);
  return destination.uri;
}

/** Drops a staged file once its upload has landed, or when its record is dropped. */
export function discardStagedMedia(uri: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // a file already gone is the outcome we wanted
  }
}
