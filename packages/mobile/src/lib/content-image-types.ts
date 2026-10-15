export interface PickedContentImage { uri: string; fileName: string; mimeType: string; size?: number }
export interface StoredContentImage {
  id: string;
  name: string;
  mimeType: string;
  uploadedId?: string;
  fingerprint?: string;
  verifiedAt?: number;
}
export interface LoadedContentImage extends StoredContentImage { uri: string; dataUrl: string }
