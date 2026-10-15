import { useQuery } from "@tanstack/react-query";
import { filesApi } from "@/api/files";
import { useProjectAccess } from "@/hooks/use-participants";
import { canResourceAction } from "@/lib/project-types";

export function CommentAudio({ projectId, fileId }: { projectId: string; fileId: string }) {
  const access = useProjectAccess(projectId);
  const allowed = !access.isError && canResourceAction(access.data, "updates", "view");
  const audio = useQuery({ queryKey: ["comment-audio", projectId, fileId],
    queryFn: () => filesApi.resolveUrl(fileId), enabled: allowed, staleTime: 0, gcTime: 0 });
  if (!allowed) return null;
  return audio.data ? <audio className="mt-2 w-full" controls preload="none" src={audio.data} aria-label="Voice note" /> :
    <p className="mt-2 text-xs text-ink-muted">{audio.isError ? "Could not load this voice note." : "Loading voice note…"}</p>;
}
CommentAudio.displayName = "CommentAudio";
