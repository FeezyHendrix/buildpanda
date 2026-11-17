import { filesApi } from "@/api/files";
import { useContentUpload } from "@/hooks/use-content-files";
import { Spinner } from "@/components/atoms/spinner";
import { toast } from "@/lib/toast";
import { RichTextEditorCore, type RichTextEditorCoreProps } from "./rich-text-editor-core";

export type { UploadedAttachment, RichTextEditorHandle } from "./rich-text-editor-core";

type Props = Omit<RichTextEditorCoreProps, "upload" | "resolveFile" | "onUploadError"> & { projectId?: string };

export function RichTextEditor({ projectId, ...props }: Props) {
  const upload = useContentUpload(projectId);
  return <RichTextEditorCore {...props} upload={upload} uploadIndicator={<Spinner size="xs" />} resolveFile={filesApi.resolveUrl} onUploadError={(message) => toast(message, "error")} />;
}

RichTextEditor.displayName = "RichTextEditor";
