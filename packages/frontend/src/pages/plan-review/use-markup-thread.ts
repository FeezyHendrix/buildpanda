import { useState } from "react";
import type { DrawingMarkup } from "@/api/drawing-markup";
import type { MarkupThreadActions, MarkupThreadLink } from "@/components/molecules/markup-thread/markup-thread-popover";
import {
  useResolveDrawingMarkup,
  type useAddMarkupComment,
  type useDeleteDrawingMarkup,
} from "@/hooks/use-drawing-markup";
import { FOLLOW_UP_META, type CommentAssignee } from "@/lib/markup-meta";
import type { ThreadTarget } from "./use-markup-tools";

interface MarkupThreadArgs {
  projectId: string | undefined;
  assignees: CommentAssignee[];
  addComment: ReturnType<typeof useAddMarkupComment>;
  remove: ReturnType<typeof useDeleteDrawingMarkup>;
}

export interface MarkupThreadController {
  target: ThreadTarget | null;
  setTarget: (target: ThreadTarget | null) => void;
  actions: MarkupThreadActions;
  assignees: CommentAssignee[];
  /** The RFI / approval raised off a markup, linked to the page it lives on. */
  linksFor: (markup: DrawingMarkup) => MarkupThreadLink[];
  /** Only a project drawing has a thread to write to; the backend enforces who may. */
  canEdit: boolean;
}

function followUpLinks(projectId: string | undefined, markup: DrawingMarkup): MarkupThreadLink[] {
  if (!projectId) return [];
  const links: MarkupThreadLink[] = [];
  if (markup.linkedRfiId) {
    links.push({ id: markup.linkedRfiId, label: `Linked ${FOLLOW_UP_META.rfi.label}`, to: `/project/${projectId}/rfis` });
  }
  if (markup.linkedApprovalId) {
    links.push({
      id: markup.linkedApprovalId,
      label: `Linked ${FOLLOW_UP_META.approval.label}`,
      to: `/project/${projectId}/approvals`,
    });
  }
  return links;
}

/**
 * The open thread on the review stage: which persisted markup it belongs to,
 * where the popover hangs, and the mutations the office answers the field with.
 */
export function useMarkupThread({ projectId, assignees, addComment, remove }: MarkupThreadArgs): MarkupThreadController {
  const [target, setTarget] = useState<ThreadTarget | null>(null);
  const resolve = useResolveDrawingMarkup(projectId);
  return {
    target,
    setTarget,
    actions: { addComment, resolve, remove },
    assignees,
    linksFor: (markup) => followUpLinks(projectId, markup),
    canEdit: Boolean(projectId),
  };
}
