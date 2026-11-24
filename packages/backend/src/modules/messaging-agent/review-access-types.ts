export interface MessagingReviewTargetScope {
  financialCosts?: boolean;
  financialView?: boolean;
  projectId: string;
  organizationId: string | null;
  userId: string;
  fullTasks: boolean;
  internalRfis: boolean;
  projectMessages: boolean;
  workspaceMessages: boolean;
  tasks?: boolean;
  expenses?: boolean;
  fullExpenses?: boolean;
  rfis?: boolean;
  updates?: boolean;
  documents?: boolean;
}

export interface MessagingReviewTargetAction { kind: string; payload: Record<string, unknown>; result?: Record<string, unknown> | null }
