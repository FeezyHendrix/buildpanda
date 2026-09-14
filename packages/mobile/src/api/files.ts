import { randomUUID } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { FileSystemUploadType, uploadAsync } from "expo-file-system/legacy";
import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";
import { ApiError } from "./client";

export interface UploadedFile {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

// The multipart filename is the last path segment of the uploaded URI, so the
// bytes are copied under the name the crew member picked before sending. The
// copy lives in the document directory, not the cache: a push can be retried
// hours later, and the OS reclaims the cache under storage pressure.
const UPLOAD_DIR_NAME = "upload-staging";

function uploadDir(): Directory {
  const dir = new Directory(Paths.document, UPLOAD_DIR_NAME, randomUUID());
  dir.create({ intermediates: true });
  return dir;
}

export async function uploadProjectFile(
  projectId: string,
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<UploadedFile> {
  const headers: Record<string, string> = {};
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

  const safeName = fileName.replace(/[/\\]/g, "_");
  const dir = uploadDir();
  const named = new File(dir, safeName);
  try {
    new File(uri).copy(named);

    const result = await uploadAsync(`${API_BASE_URL}/files`, named.uri, {
      httpMethod: "POST",
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      parameters: { projectId },
      headers,
    });

    if (result.status < 200 || result.status >= 300) {
      // carries the status so the outbox can tell a permanent rejection from a dropped connection
      throw new ApiError(result.status, `Upload failed (${result.status})`);
    }
    return JSON.parse(result.body) as UploadedFile;
  } finally {
    try {
      if (dir.exists) dir.delete();
    } catch {
      // the named copy is only needed for the duration of one send
    }
  }
}
