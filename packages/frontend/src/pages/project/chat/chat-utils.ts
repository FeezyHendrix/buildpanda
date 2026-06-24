export function chatFileUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${base}/files/${fileId}/download`;
}
