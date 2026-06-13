import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { UploadedFile } from "@/lib/project-types";

export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<UploadedFile>("/files", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
  });
}
