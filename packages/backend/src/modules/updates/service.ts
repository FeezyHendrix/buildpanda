import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { UpdateContentPatch, UpdatesRepository } from "./repository.ts";
import type {
  CtaTone,
  MediaItem,
  MediaType,
  ProjectUpdate,
  UpdateAction,
  UpdateCategory,
  UpdateComment,
  UpdateCommentRow,
  UpdateMediaRow,
  UpdateRow,
  UpdateStatus,
} from "./types.ts";

const ALLOWED_TRANSITIONS: Record<string, UpdateStatus[]> = {
  Progress: ["Approved"],
  "Material Delivery": ["Inspected"],
  Inspections: ["Approved"],
  Issues: ["Resolved", "Escalated"],
};

export const CTA_DEFAULTS: Record<UpdateCategory, { label: string; tone: CtaTone }> = {
  Progress: { label: "Approve", tone: "primary" },
  "Material Delivery": { label: "Mark as Inspected", tone: "primary" },
  Inspections: { label: "Approve", tone: "primary" },
  Issues: { label: "View Resolution Plan", tone: "secondary" },
};

export interface TransitionUpdateInput {
  status: UpdateStatus;
}

export interface AddCommentInput {
  body: string;
}

export interface MediaInput {
  type: MediaType;
  url: string;
}

export interface CreateUpdateInput {
  category: UpdateCategory;
  title: string;
  description: string;
  descriptionHtml?: string | null;
  media?: MediaInput[];
  activityId?: string | null;
}

export interface EditUpdateInput {
  category?: UpdateCategory;
  title?: string;
  description?: string;
  descriptionHtml?: string | null;
  media?: MediaInput[];
}

function toMedia(row: UpdateMediaRow): MediaItem {
  return { id: row.id, type: row.type, url: row.url };
}

function buildMediaRows(
  updateId: string,
  media: MediaInput[] | undefined,
): UpdateMediaRow[] {
  if (!media) return [];
  return media.map((item, index) => ({
    id: generateId("media"),
    update_id: updateId,
    type: item.type,
    url: item.url,
    sort_order: index,
  }));
}

function toAction(row: UpdateRow): UpdateAction {
  return {
    status: row.status,
    takenAt: row.action_taken_at ? new Date(row.action_taken_at).toISOString() : null,
    takenBy:
      row.action_taken_by_id && row.action_taken_by_name
        ? { id: row.action_taken_by_id, name: row.action_taken_by_name }
        : null,
  };
}

export function toUpdate(row: UpdateRow, media: UpdateMediaRow[]): ProjectUpdate {
  const result: ProjectUpdate = {
    id: row.id,
    projectId: row.project_id,
    activityId: row.activity_id,
    author: {
      id: row.author_id,
      name: row.author_name,
      role: row.author_role,
      initialsTone: row.author_initials_tone,
      ...(row.author_avatar_url ? { avatarUrl: row.author_avatar_url } : {}),
    },
    category: row.category,
    title: row.title,
    description: row.description,
    descriptionHtml: row.description_html,
    media: media.map(toMedia),
    cta: { label: row.cta_label, tone: row.cta_tone },
    status: row.status,
    action: toAction(row),
    isDraft: row.is_draft,
    generatedKind: row.generated_kind,
    createdAt: new Date(row.created_at).toISOString(),
  };
  if (row.secondary_action_label) {
    result.secondaryAction = { label: row.secondary_action_label };
  }
  return result;
}

function toComment(row: UpdateCommentRow): UpdateComment {
  return {
    id: row.id,
    updateId: row.update_id,
    author: { id: row.author_id, name: row.author_name },
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function updatesService(repository: UpdatesRepository) {
  async function loadUpdate(
    projectId: string,
    updateId: string,
  ): Promise<UpdateRow> {
    const row = await repository.findById(updateId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Update");
    return row;
  }

  return {
    async listByProject(
      projectId: string,
      options: { includeDrafts?: boolean } = {},
    ): Promise<ProjectUpdate[]> {
      const rows = await repository.listByProject(projectId, options);
      if (rows.length === 0) return [];
      const media = await repository.mediaForUpdates(rows.map((r) => r.id));
      const grouped = new Map<string, UpdateMediaRow[]>();
      for (const m of media) {
        const list = grouped.get(m.update_id) ?? [];
        list.push(m);
        grouped.set(m.update_id, list);
      }
      return rows.map((row) => toUpdate(row, grouped.get(row.id) ?? []));
    },

    async transition(
      projectId: string,
      updateId: string,
      input: TransitionUpdateInput,
      actor: { id: string; name: string },
    ): Promise<ProjectUpdate> {
      const current = await loadUpdate(projectId, updateId);

      if (current.is_draft) {
        throw new BadRequestError("Publish the draft before taking action on it");
      }
      const allowed = ALLOWED_TRANSITIONS[current.category];
      if (!allowed || !allowed.includes(input.status)) {
        throw new BadRequestError(
          `Cannot transition ${current.category} update to ${input.status}`,
        );
      }
      if (current.status !== "Open") {
        throw new BadRequestError(
          `Update is already in status ${current.status}`,
        );
      }

      const updated = await repository.transitionStatus({
        updateId,
        status: input.status,
        actorId: actor.id,
        actorName: actor.name,
      });
      const media = await repository.mediaForUpdates([updated.id]);
      return toUpdate(updated, media);
    },

    async listComments(
      projectId: string,
      updateId: string,
    ): Promise<UpdateComment[]> {
      await loadUpdate(projectId, updateId);
      const rows = await repository.listComments(updateId);
      return rows.map(toComment);
    },

    async addComment(
      projectId: string,
      updateId: string,
      input: AddCommentInput,
      actor: { id: string; name: string },
    ): Promise<UpdateComment> {
      await loadUpdate(projectId, updateId);
      const row = await repository.addComment({
        id: generateId("comment"),
        update_id: updateId,
        author_id: actor.id,
        author_name: actor.name,
        body: input.body,
      });
      return toComment(row);
    },

    async create(
      projectId: string,
      input: CreateUpdateInput,
      actor: { id: string; name: string },
    ): Promise<ProjectUpdate> {
      const cta = CTA_DEFAULTS[input.category];
      const updateId = generateId("update");
      const mediaRows = buildMediaRows(updateId, input.media);
      const row = await repository.createUpdate(
        {
          id: updateId,
          project_id: projectId,
          author_id: actor.id,
          author_name: actor.name,
          author_role: "Project Manager",
          author_initials_tone: "brand",
          activity_id: input.activityId ?? null,
          category: input.category,
          title: input.title,
          description: input.description,
          description_html: input.descriptionHtml ?? null,
          cta_label: cta.label,
          cta_tone: cta.tone,
          status: "Open",
          created_at: new Date(),
        },
        mediaRows,
      );
      return toUpdate(row, mediaRows);
    },

    async edit(
      projectId: string,
      updateId: string,
      input: EditUpdateInput,
    ): Promise<ProjectUpdate> {
      await loadUpdate(projectId, updateId);

      const patch: UpdateContentPatch = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      if (input.category !== undefined) {
        patch.category = input.category;
        const cta = CTA_DEFAULTS[input.category];
        patch.cta_label = cta.label;
        patch.cta_tone = cta.tone;
      }
      if (Object.keys(patch).length === 0 && input.media === undefined) {
        throw new BadRequestError("No fields to update");
      }

      const row =
        Object.keys(patch).length > 0
          ? await repository.editUpdate(updateId, patch)
          : await loadUpdate(projectId, updateId);

      if (input.media !== undefined) {
        await repository.replaceMedia(updateId, buildMediaRows(updateId, input.media));
      }

      const media = await repository.mediaForUpdates([updateId]);
      return toUpdate(row, media);
    },

    async publish(projectId: string, updateId: string): Promise<ProjectUpdate> {
      const current = await loadUpdate(projectId, updateId);
      if (!current.is_draft) {
        throw new BadRequestError("Update is already published");
      }
      const row = await repository.publishUpdate(updateId);
      const media = await repository.mediaForUpdates([updateId]);
      return toUpdate(row, media);
    },

    async remove(projectId: string, updateId: string): Promise<void> {
      await loadUpdate(projectId, updateId);
      await repository.deleteUpdate(updateId);
    },
  };
}

export type UpdatesService = ReturnType<typeof updatesService>;
