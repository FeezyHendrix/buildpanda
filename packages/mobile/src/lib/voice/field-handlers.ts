import { serverActionCache } from "@/db/server-action-cache";
import { remoteResult } from "./remote-result";
import { tasksApi } from '@/api/tasks';
import { tasksRepository } from '@/db/tasks-repository';
import { expensesRepository } from '@/db/expenses-repository';
import { materialApprovalsRepository } from '@/db/material-approvals-repository';
import { materialApprovalCommentsRepository } from '@/db/material-approval-comments-repository';
import { materialsRepository } from '@/db/materials-repository';
import { rfiCommentsRepository } from '@/db/rfi-comments-repository';
import { changes, option, required, type VoiceHandlerMap } from './types';
import { voiceRecords } from './records';

export const fieldHandlers = {
  async create_task(p, c) {
    const buildingId = required(p.buildingId);
    await voiceRecords(c).board(buildingId);
    const assignee = p.assigneeId ? option(c, 'assignees', p.assigneeId) : null;
    await tasksRepository.createLocal(c.db, c.projectId, buildingId, {
      title: required(p.title), description: p.description, dueDate: p.dueDate, priority: p.priority ?? 'Medium',
      assignees: assignee ? [{ kind: 'user', id: assignee.value, name: assignee.label }] : [],
    }, c.userId);
    return { queued: true };
  },
  async update_task(p, c) {
    const row = await voiceRecords(c).task(required(p.taskId));
    if (row.isPendingSync) throw new Error('Sync this task’s queued changes before editing it online.');
    const assignee = p.assigneeId ? option(c, 'assignees', p.assigneeId) : null;
    const assignees = assignee ? [{ kind: 'user' as const, id: assignee.value, name: assignee.label }] : undefined;
    const patch = changes({ title: p.title, description: p.description, dueDate: p.dueDate, priority: p.priority });
    await tasksApi.update(c.projectId, required(p.taskId), { ...patch, ...(assignees ? { assignees: assignees.map(({ kind, id }) => ({ kind, id })) } : {}) });
    return remoteResult(() => serverActionCache.task(c.db, c.projectId, required(p.taskId), { ...patch, ...(assignees ? { assignees: JSON.stringify(assignees), assignedToMe: assignee?.value === c.userId } : {}) }));
  },
  async move_task(p, c) {
    await voiceRecords(c).task(required(p.taskId));
    await tasksRepository.moveLocal(c.db, c.projectId, required(p.taskId), required(p.columnId));
    return { queued: true };
  },
  async delete_task(p, c) {
    const row = await voiceRecords(c).task(required(p.taskId));
    if (row.isPendingSync) throw new Error('Sync this task’s queued changes before deleting it.');
    await tasksApi.remove(c.projectId, required(p.taskId));
    return remoteResult(() => serverActionCache.task(c.db, c.projectId, required(p.taskId)));
  },
  async comment_task(p, c) {
    await tasksApi.comment(c.projectId, required(p.taskId), required(p.body));
    return { queued: false };
  },
  async create_expense(p, c) {
    const category = option(c, 'expenseCategories', p.category);
    await expensesRepository.createLocal(c.db, c.projectId, {
      title: required(p.title), amount: required(p.amount), category: category.value, categoryLabel: category.label,
      transactedAt: required(p.transactedAt), vendor: p.vendor, description: p.description, stageId: p.stageId,
      credit: p.credit === 'yes', receipt: null, createdByName: c.authorName,
    });
    return { queued: true };
  },
  async create_material_approval(p, c) {
    await materialApprovalsRepository.createLocal(c.db, c.projectId, {
      title: required(p.title), materialName: required(p.materialName), quantity: required(p.quantity), unit: required(p.unit),
      specification: p.specification, supplier: p.supplier, neededBy: p.neededBy, requestedReviewerId: p.requestedReviewerId,
      requestedReviewerName: p.requestedReviewerId ? option(c, 'reviewers', p.requestedReviewerId).label : null,
    });
    return { queued: true };
  },
  async update_material_approval(p, c) {
    await voiceRecords(c).approval(required(p.approvalId));
    await materialApprovalsRepository.updateLocal(c.db, c.projectId, required(p.approvalId),
      changes({ title: p.title, specification: p.specification, supplier: p.supplier, neededBy: p.neededBy }));
    return { queued: true };
  },
  async decide_material_approval(p, c) {
    await voiceRecords(c).approval(required(p.approvalId));
    await materialApprovalsRepository.decideLocal(c.db, c.projectId, required(p.approvalId),
      { status: required(p.status), response: required(p.response), reviewerName: c.authorName });
    return { queued: true };
  },
  async reopen_material_approval(p, c) {
    await voiceRecords(c).approval(required(p.approvalId));
    await materialApprovalsRepository.decideLocal(c.db, c.projectId, required(p.approvalId),
      { status: 'Pending', response: null, reviewerName: null });
    return { queued: true };
  },
  async delete_material_approval(p, c) {
    await voiceRecords(c).approval(required(p.approvalId));
    await materialApprovalsRepository.deleteLocal(c.db, c.projectId, required(p.approvalId));
    return { queued: true };
  },
  async comment_material_approval(p, c) {
    await voiceRecords(c).approval(required(p.approvalId));
    await materialApprovalCommentsRepository.createLocal(c.db, c.projectId,
      { approvalId: required(p.approvalId), body: required(p.body), authorName: c.authorName });
    return { queued: true };
  },
  async receive_material_order(p, c) {
    await voiceRecords(c).order(required(p.orderId));
    await materialsRepository.recordDeliveryLocal(c.db, c.projectId, required(p.orderId), required(p.quantity), p.note);
    return { queued: true };
  },
  async respond_rfi(p, c) {
    await voiceRecords(c).rfi(required(p.rfiId));
    const body = required(p.body);
    await rfiCommentsRepository.createLocal(c.db, c.projectId, required(p.rfiId), body.text, c.authorName, body.html, true);
    return { queued: true };
  },
} satisfies Partial<VoiceHandlerMap>;
