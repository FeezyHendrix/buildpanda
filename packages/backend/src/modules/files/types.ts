export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface UploadedFileRow {
  id: string;
  owner_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | string;
  storage_path: string;
  created_at: Date | string;
}
