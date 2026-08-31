import {
  cacheDirectory,
  copyAsync,
  FileSystemUploadType,
  makeDirectoryAsync,
  uploadAsync,
} from "expo-file-system/legacy";
import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";

export interface UploadedFile {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
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
  const dir = `${cacheDirectory ?? ""}bp-upload-${Date.now()}/`;
  await makeDirectoryAsync(dir, { intermediates: true });
  const stagedUri = `${dir}${safeName}`;
  await copyAsync({ from: uri, to: stagedUri });

  const result = await uploadAsync(`${API_BASE_URL}/files`, stagedUri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    parameters: { projectId },
    headers,
  });

  if (result.status < 200 || result.status >= 300) throw new Error(`Upload failed (${result.status})`);
  return JSON.parse(result.body) as UploadedFile;
}
