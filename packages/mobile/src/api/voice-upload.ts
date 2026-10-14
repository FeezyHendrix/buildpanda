import { FileSystemUploadType, createUploadTask } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export async function uploadRecording(url: string, audioUri: string, headers: Record<string, string>, signal?: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) throw new Error('Recording processing was cancelled.');
  signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; cancel(); }, 120_000);
  try {
    if (Platform.OS === 'web') {
      if (!audioUri.startsWith('blob:')) throw new Error('Record a voice note in this browser first.');
      const audio = await fetch(audioUri, { signal: controller.signal }).then((response) => response.blob());
      const form = new FormData();
      form.append('audio', audio, 'field-note.webm');
      const response = await fetch(url, { method: 'POST', body: form, credentials: 'include', headers, signal: controller.signal });
      return { status: response.status, body: await response.text() };
    }
    const upload = createUploadTask(url, audioUri, { httpMethod: 'POST', uploadType: FileSystemUploadType.MULTIPART, fieldName: 'audio', mimeType: 'audio/m4a', headers });
    const abortUpload = () => { void upload.cancelAsync().catch(() => undefined); };
    controller.signal.addEventListener('abort', abortUpload, { once: true });
    try {
      const result = await upload.uploadAsync();
      if (!result || controller.signal.aborted) throw new Error('Recording processing was cancelled.');
      return result;
    } finally { controller.signal.removeEventListener('abort', abortUpload); }
  } catch (error) {
    if (timedOut) throw new Error('Processing timed out. Your recording is still available to retry.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
