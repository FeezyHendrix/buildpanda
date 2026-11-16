import type { fieldToolDescriptor } from "../field-actions/tools.ts";

export interface MessagingReadTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface MessagingToolDiscovery {
  tools: ReturnType<typeof fieldToolDescriptor>[];
  targets: Record<string, unknown>;
  reads: MessagingReadTool[];
  executedReads: string[];
  uploads: boolean;
  runRead(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface MessagingRfiTarget { id: string; number: number; subject: string; status: string }
export interface MessagingLedgerTarget { id: string; entryType: string; materialName: string; quantity: string; unit: string; status: string; approvalStatus: string }
export interface MessagingDiaryTarget { id: string; buildingId: string; logDate: Date | string; authorId: string | null; authorName: string; snippet: string }
