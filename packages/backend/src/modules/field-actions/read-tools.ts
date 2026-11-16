import type { AgentTool } from "../panda-ai/agent/tool-helpers.ts";
import { workRecordReadTools } from "./read-tools-work.ts";
import { siteRecordReadTools } from "./read-tools-site.ts";
import { programmeReadTools } from "./read-tools-programme.ts";
import { documentReadTools } from "./read-tools-documents.ts";
import { conversationReadTools } from "./read-tools-conversations.ts";
export { fieldReadToolPermissions, fieldReadToolFeatures } from "./read-tools-policy.ts";

export function buildFieldReadTools(): AgentTool[] {
  return [...workRecordReadTools(), ...siteRecordReadTools(), ...programmeReadTools(), ...documentReadTools(), ...conversationReadTools()];
}
