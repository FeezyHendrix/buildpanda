import { useSearchParams } from "react-router-dom";
import { useTaskDetail } from "@/hooks/use-tasks";

export function useTaskDestination(projectId: string) {
  const [params, setParams] = useSearchParams();
  const target = params.get("task");
  const creating = target === "new";
  const detail = useTaskDetail(projectId, creating ? null : target);

  function open(taskId: string, columnId?: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("task", taskId);
      if (columnId) next.set("column", columnId);
      else next.delete("column");
      return next;
    }, { replace: true });
  }

  function close() {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("task");
      next.delete("column");
      return next;
    }, { replace: true });
  }

  return {
    target, creating, open, close,
    task: detail.data ?? null,
    columnId: params.get("column"),
    pending: Boolean(target) && !creating && detail.isPending,
    error: detail.error,
    retry: detail.refetch,
  };
}
