import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import type { AccessScope } from "./access-policy";

// Native builds cache plan files on disk (download-file.ts); this module is
// the platform seam the web sibling fills with browser storage. Only the
// base64 reader does real work here.

export async function cacheVersionBytes(_scope: AccessScope, _versionId: string, _bytes: Blob): Promise<string> {
  throw new Error("Native builds cache plan files on disk, not in browser storage.");
}

export async function cachedVersionUri(_scope: AccessScope, _versionId: string): Promise<string | null> {
  return null;
}

export async function readCachedDocumentBase64(uri: string): Promise<string> {
  return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
}

export async function clearCachedDocuments(_scope?: AccessScope): Promise<void> {}
