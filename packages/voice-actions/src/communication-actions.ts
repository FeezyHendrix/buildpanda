import { features as f, messagingAccess } from './features.ts';
import { allOf, anyOf } from './access.ts';
import { defineVoiceAction as action, textField as text, longTextField as longText, targetField as target, choiceField as choice } from './types.ts';

const send = anyOf(f.messages.actions.create, f.workspaceMessages.actions.create);
const updateFields = { title: text('Title'), description: longText('Update'), category: choice('Category', ['Progress', 'Material Delivery', 'Inspections', 'Issues']), stageId: target('Stage', 'stages', false) };
export const communicationActions = {
  send_message: action({ label: 'Send message', icon: 'chatbubble-outline', permission: send, online: true,
    instruction: 'Send the stated message to an existing conversation from sendableChannels. Never choose a recipient that was not stated.', fields: { channelId: target('Conversation', 'sendableChannels'), body: { ...longText('Message'), images: false } } }),
  send_direct_message: action({ label: 'Send direct message', icon: 'person-outline', permission: f.workspaceMessages.actions.create, online: true,
    instruction: 'Send a direct message to a named workspace member. Resolve only from workspaceMembers; ask if ambiguous.', fields: { userId: target('Recipient', 'workspaceMembers'), body: { ...longText('Message'), images: false } } }),
  reply_message: action({ label: 'Reply to message', icon: 'return-down-forward-outline', permission: allOf(messagingAccess, send), online: true,
    instruction: 'Reply in a thread to a specific message from replyTargets. Never invent or reuse a message ID from another channel.', fields: { messageId: target('Reply to', 'replyTargets'), body: { ...longText('Reply'), images: false } } }),
  create_project_update: action({ label: 'Post project update', icon: 'megaphone-outline', permission: f.updates.actions.create,
    instruction: 'Publish a project progress update for the team. A private site diary entry uses daily_log instead.', fields: updateFields }),
  edit_project_update: action({ label: 'Edit project update', icon: 'create-outline', permission: f.updates.actions.edit, online: true,
    instruction: 'Edit a published project update; only include changes explicitly requested.', fields: { updateId: target('Update', 'updates'), title: text('Title', false), description: longText('Update', false) } }),
  delete_project_update: action({ label: 'Delete project update', icon: 'trash-outline', permission: f.updates.actions.edit, online: true, destructive: true,
    instruction: 'Delete a project update only when explicitly requested.', fields: { updateId: target('Update', 'updates') } }),
  comment_project_update: action({ label: 'Comment on project update', icon: 'chatbubble-outline', permission: f.updates.actions.comment, online: true,
    instruction: 'Add a comment to a published project update.', fields: { updateId: target('Update', 'updates'), body: longText('Comment') } }),
} as const;
