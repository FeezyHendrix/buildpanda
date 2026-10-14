import { features as f } from './features.ts';
import { defineVoiceAction as action, textField as text, longTextField as longText, richTextField as richText, numberField as number, dateField as date, targetField as target, choiceField as choice } from './types.ts';

const taskFields = { title: text('Task'), buildingId: target('Building', 'buildings'), description: longText('Description', false), dueDate: date('Due date', false), priority: choice('Priority', ['Low', 'Medium', 'High'], false), assigneeId: target('Assign to', 'assignees', false) };
const approvalFields = { title: text('Request title'), materialName: text('Material'), specification: longText('Specification', false), quantity: number('Quantity', 0.001), unit: text('Unit'), supplier: text('Supplier', false), neededBy: date('Needed by', false), requestedReviewerId: target('Reviewer', 'reviewers', false) };

export const fieldActions = {
  create_task: action({ label: 'Create task', icon: 'checkbox-outline', permission: f.tasks.actions.create,
    instruction: 'Create a task; use an assignee ID only from assignees. Keep an unspecified building for review.', fields: taskFields }),
  update_task: action({ label: 'Edit task', icon: 'create-outline', permission: f.tasks.actions.edit, online: true,
    instruction: 'Edit the title, description or due date of an existing task. Supply only requested changes.', fields: { taskId: target('Task', 'tasks'), title: text('Title', false), description: longText('Description', false), dueDate: date('Due date', false), priority: choice('Priority', ['Low', 'Medium', 'High'], false), assigneeId: target('Assignee', 'assignees', false) } }),
  move_task: action({ label: 'Change task status', icon: 'swap-vertical-outline', permission: f.tasks.actions.move,
    instruction: 'Move an existing task to a named column/status in its own building.', fields: { taskId: target('Task', 'tasks'), columnId: target('Status', 'taskColumns') } }),
  delete_task: action({ label: 'Delete task', icon: 'trash-outline', permission: f.tasks.actions.remove, destructive: true, online: true,
    instruction: 'Delete an existing task only when explicitly requested.', fields: { taskId: target('Task', 'tasks') } }),
  comment_task: action({ label: 'Comment on task', icon: 'chatbubble-outline', permission: f.tasks.actions.comment, online: true,
    instruction: 'Add a comment to an existing task.', fields: { taskId: target('Task', 'tasks'), body: longText('Comment') } }),
  create_expense: action({ label: 'Record expense', icon: 'receipt-outline', permission: f.expenses.actions.create,
    instruction: 'Record money already spent elsewhere; never make a payment. Amount must be positive. Use an expenseCategories value. Ask for missing amount/date/category. credit yes means a refund.',
    fields: { title: text('Expense'), amount: number('Amount', 0.01), category: target('Category', 'expenseCategories'), transactedAt: date('Date paid'), vendor: text('Vendor', false), description: longText('Description', false), stageId: target('Stage', 'stages', false), credit: choice('Refund or credit', ['yes', 'no'], false) } }),
  create_material_approval: action({ label: 'Request material approval', icon: 'checkmark-circle-outline', permission: f.materialApprovals.actions.create,
    instruction: 'Request approval of a material/specification before procurement. This is distinct from ordering or receiving it.', fields: approvalFields }),
  update_material_approval: action({ label: 'Edit material approval', icon: 'create-outline', permission: f.materialApprovals.actions.edit,
    instruction: 'Edit a Pending or Resubmit material approval request. Supply only requested changes.', fields: { approvalId: target('Request', 'editableApprovals'), title: text('Title', false), specification: longText('Specification', false), supplier: text('Supplier', false), neededBy: date('Needed by', false) } }),
  decide_material_approval: action({ label: 'Decide material approval', icon: 'checkmark-done-outline', permission: f.materialApprovals.actions.decide,
    instruction: 'Approve, reject or request resubmission of an existing request. Use decidableApprovals; only the named reviewer may decide.',
    fields: { approvalId: target('Request', 'decidableApprovals'), status: choice('Decision', ['Approved', 'Rejected', 'Resubmit']), response: longText('Decision reason') } }),
  reopen_material_approval: action({ label: 'Reopen material approval', icon: 'refresh-outline', permission: f.materialApprovals.actions.reopen,
    instruction: 'Return a Resubmit material request to Pending. Approved/Rejected records are immutable.', fields: { approvalId: target('Request', 'reopenableApprovals') } }),
  delete_material_approval: action({ label: 'Delete material approval', icon: 'trash-outline', permission: f.materialApprovals.actions.remove, destructive: true,
    instruction: 'Delete a Pending material approval request only when explicitly requested.', fields: { approvalId: target('Request', 'pendingApprovals') } }),
  comment_material_approval: action({ label: 'Comment on material approval', icon: 'chatbubble-outline', permission: f.materialApprovals.actions.comment,
    instruction: 'Add a comment to an existing material approval.', fields: { approvalId: target('Request', 'materialApprovals'), body: longText('Comment') } }),
  receive_material_order: action({ label: 'Receive ordered materials', icon: 'cube-outline', permission: f.materialOrders.actions.receive,
    instruction: 'Record delivered quantity against a specifically named approved order. A receipt with no matching order uses material_log instead.', fields: { orderId: target('Order', 'receivableOrders'), quantity: number('Quantity received', 0.001), note: longText('Delivery note', false) } }),
  respond_rfi: action({ label: 'Official RFI response', icon: 'checkmark-circle-outline', permission: f.rfis.actions.officialResponse,
    instruction: 'Post an official answer to an open RFI only when explicitly requested; ordinary discussion uses comment_rfi.', fields: { rfiId: target('RFI', 'respondableRfis'), body: richText('Official response') } }),
} as const;
