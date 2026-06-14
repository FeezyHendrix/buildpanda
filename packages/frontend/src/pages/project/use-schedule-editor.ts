import { useCallback, useRef, useState } from "react";
import { api } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { activityKeys } from "@/hooks/query-keys";
import type { Activity } from "@/lib/project-types";

interface GanttApi {
  on: (event: string, handler: (ev: Record<string, unknown>) => void) => void;
  intercept?: (event: string, handler: (ev: Record<string, unknown>) => boolean | void) => void;
}

interface UpdateTaskEvent {
  id?: string | number;
  task?: { start?: Date; end?: Date; text?: string };
}

interface DateEdit {
  activityId: string;
  before: { start?: string; end?: string };
  after: { start?: string; end?: string };
}

const HISTORY_LIMIT = 50;
const DEBOUNCE_MS = 400;

function isActivityTaskId(id: unknown): id is string {
  return typeof id === "string" && id.startsWith("act") && !id.includes("-act_");
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return undefined;
}

export function useScheduleEditor(projectId: string, activities: Activity[]) {
  const qc = useQueryClient();
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const past = useRef<DateEdit[]>([]);
  const future = useRef<DateEdit[]>([]);
  const [, setVersion] = useState(0);

  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: activityKeys.all(projectId) });
    qc.invalidateQueries({ queryKey: ["projects", projectId, "detail"] });
  }, [projectId, qc]);

  const sendPatch = useCallback(
    (activityId: string, start?: string, end?: string) => {
      const body: Record<string, string> = {};
      if (start) body.plannedStartAt = start;
      if (end) body.plannedEndAt = end;
      if (Object.keys(body).length === 0) return Promise.resolve();
      return api
        .patch(`/projects/${projectId}/activities/${activityId}`, body)
        .then(invalidate)
        .catch(invalidate);
    },
    [projectId, invalidate],
  );

  const recordAndPersist = useCallback(
    (activityId: string, after: { start?: string; end?: string }) => {
      const current = activitiesRef.current.find((a) => a.id === activityId);
      const before = {
        start: current?.plannedStartAt ?? undefined,
        end: current?.plannedEndAt ?? undefined,
      };
      if (before.start === after.start && before.end === after.end) return;

      past.current.push({ activityId, before, after });
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      setVersion((v) => v + 1);

      const existing = pending.current.get(activityId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        pending.current.delete(activityId);
        void sendPatch(activityId, after.start, after.end);
      }, DEBOUNCE_MS);
      pending.current.set(activityId, timer);
    },
    [sendPatch],
  );

  const attach = useCallback(
    (ganttApi: GanttApi) => {
      const handler = (raw: Record<string, unknown>) => {
        const ev = raw as UpdateTaskEvent & { inProgress?: boolean };
        if (ev.inProgress) return;
        if (!isActivityTaskId(ev.id)) return;
        recordAndPersist(ev.id, { start: toIso(ev.task?.start), end: toIso(ev.task?.end) });
      };
      ganttApi.on("update-task", handler);
      ganttApi.on("drag-task", handler);

      ganttApi.intercept?.("add-link", (raw) => {
        const link = raw as { link?: { source?: string | number; target?: string | number } };
        const source = link.link?.source;
        const target = link.link?.target;
        if (source !== undefined && source === target) return false;
        return true;
      });
    },
    [recordAndPersist],
  );

  const undo = useCallback(() => {
    const edit = past.current.pop();
    if (!edit) return;
    future.current.push(edit);
    setVersion((v) => v + 1);
    void sendPatch(edit.activityId, edit.before.start, edit.before.end);
  }, [sendPatch]);

  const redo = useCallback(() => {
    const edit = future.current.pop();
    if (!edit) return;
    past.current.push(edit);
    setVersion((v) => v + 1);
    void sendPatch(edit.activityId, edit.after.start, edit.after.end);
  }, [sendPatch]);

  return {
    attach,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
