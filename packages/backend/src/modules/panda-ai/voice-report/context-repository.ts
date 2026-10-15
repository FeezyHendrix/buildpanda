import type { Knex } from 'knex';
import type { VoiceOptions, VoiceOption } from '@buildpanda/voice-actions';
import { PRESET_TRANSACTION_CATEGORIES } from '../../transactions/types.ts';
import type { VoiceCaller } from './context-types.ts';
import { applyTaskVisibility } from '../../tasks/visibility-repository.ts';

/** Only authorized target labels enter the model context or the review pickers. */
export function voiceContextRepository(db: Knex) {
  return {
    async options(projectId: string, caller: VoiceCaller): Promise<VoiceOptions> {
      const { can, workspaceCan, capabilities, userId, organizationId } = caller;
      const taskAccess = can('tasks', 'view') && capabilities.canAccessTaskBoard;
      const people = () => db('member as m').join('user as u', 'u.id', 'm.userId').where('m.organizationId', organizationId)
        .select<VoiceOption[]>('u.id as value', 'u.name as label');
      const [tasks, taskColumns, assignees, approvals, documents, documentCategories, markups, updates, workspaceMembers, categories] = await Promise.all([
        taskAccess ? db('tasks as t').where('t.project_id', projectId)
          .modify((query) => applyTaskVisibility(query, db, can('tasks', 'viewAll') ? undefined : userId))
          .select<VoiceOption[]>('t.id as value', 't.title as label', 't.board_id as parentId', 't.building_id as buildingId') : [],
        taskAccess ? db('task_columns as c').join('task_boards as b', 'b.id', 'c.board_id').where('b.project_id', projectId)
          .select<VoiceOption[]>('c.id as value', 'c.name as label', 'c.board_id as parentId', 'b.building_id as buildingId') : [],
        taskAccess ? people() : [],
        can('materials', 'view') ? db('approvals').where({ project_id: projectId, kind: 'material' })
          .select<VoiceOption[]>('id as value', 'title as label', 'status', 'requested_reviewer_id as reviewerId') : [],
        can('documents', 'view') ? db('project_documents as d').leftJoin('document_categories as c', 'c.id', 'd.category_id').where('d.project_id', projectId)
          .select<(VoiceOption & { group: string | null })[]>('d.id as value', 'd.file_name as label', 'd.current_version_id as versionId', 'c.group') : [],
        can('documents', 'view') ? db('document_categories').whereIn('group', ['document', 'plan'])
          .select<(VoiceOption & { group: string })[]>('id as value', 'name as label', 'group') : [],
        can('documents', 'view') ? db('drawing_markups as m').join('project_documents as d', 'd.id', 'm.document_id').where('m.project_id', projectId).whereNull('m.deleted_at')
          .select<VoiceOption[]>('m.id as value', db.raw("d.file_name || ' — page ' || m.page_no || ' (' || m.id || ')' as label"), 'm.document_id as parentId', 'm.document_version_id as versionId') : [],
        can('updates', 'view') ? db('project_updates').where({ project_id: projectId, is_draft: false }).select<VoiceOption[]>('id as value', 'title as label') : [],
        workspaceCan('messages', 'view') && workspaceCan('messages', 'send') ? people().whereNot('u.id', userId) : [],
        can('finances', 'viewCosts') ? db('custom_transaction_categories').where('org_id', organizationId).select<VoiceOption[]>('label as value', 'label') : [],
      ]);
      const messageOptions = await this.messageOptions(projectId, caller);
      return {
        tasks, taskColumns, assignees, materialApprovals: approvals, editableApprovals: approvals.filter((row) => ['Pending', 'Resubmit'].includes(row.status ?? '')),
        pendingApprovals: approvals.filter((row) => row.status === 'Pending'),
        reopenableApprovals: approvals.filter((row) => row.status === 'Resubmit'),
        decidableApprovals: approvals.filter((row) => ['Pending', 'Resubmit'].includes(row.status ?? '') && (!row.reviewerId || row.reviewerId === userId)),
        reviewers: can('participants', 'view') ? await people() : [],
        documents, drawings: documents.filter((row) => row.group === 'plan' && row.versionId), documentCategories, markups, updates, workspaceMembers,
        expenseCategories: can('finances', 'viewCosts') ? [...PRESET_TRANSACTION_CATEGORIES.map((row) => ({ value: row.key, label: row.label })), ...categories] : [],
        ...messageOptions,
      };
    },
    async messageOptions(projectId: string, { can, workspaceCan, userId, organizationId }: VoiceCaller): Promise<VoiceOptions> {
      const projectMessages = can('messages', 'view') && can('messages', 'send');
      const workspaceMessages = workspaceCan('messages', 'view') && workspaceCan('messages', 'send');
      if (!projectMessages && !workspaceMessages) return { sendableChannels: [], replyTargets: [] };
      const channels = await db('channels as c').join('channel_members as m', 'm.channel_id', 'c.id')
        .where('m.user_id', userId).whereNull('c.archived_at').where(function () {
          if (projectMessages) this.orWhere('c.project_id', projectId);
          if (workspaceMessages) this.orWhere(function () { this.whereNull('c.project_id').where(function () { this.where('c.organization_id', organizationId).orWhereNull('c.organization_id'); }); });
        }).select<VoiceOption[]>('c.id as value', db.raw("COALESCE(c.name, 'Direct conversation ' || c.id) as label"));
      if (!channels.length) return { sendableChannels: [], replyTargets: [] };
      const names = await db('channel_members as m').join('user as u', 'u.id', 'm.user_id').whereIn('m.channel_id', channels.map((row) => row.value)).whereNot('m.user_id', userId)
        .select<{ channelId: string; name: string }[]>('m.channel_id as channelId', 'u.name');
      for (const channel of channels) if (channel.label.startsWith('Direct conversation ')) channel.label = names.filter((row) => row.channelId === channel.value).map((row) => row.name).join(', ') || channel.label;
      const replies = await db('messages').whereIn('channel_id', channels.map((row) => row.value)).whereNull('deleted_at').orderBy('created_at', 'desc').limit(100)
        .select<VoiceOption[]>('id as value', db.raw('left(body, 160) as label'), 'channel_id as parentId');
      return { sendableChannels: channels, replyTargets: replies };
    },
  };
}
