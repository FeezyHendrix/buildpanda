import type { LeadsRepository } from "./repository.ts";
import type { LeadStatus, CreateLeadInput } from "./types.ts";
import { generateId } from "../../lib/ids.ts";

export function leadsService(repo: LeadsRepository) {
  async function createLead(input: CreateLeadInput) {
    return repo.insert({ ...input, id: generateId("lead") });
  }

  async function listForOrg(orgId: string, params: { status?: string; limit: number; offset: number }) {
    return repo.listByOrg(orgId, params);
  }

  async function updateStatus(leadId: string, orgId: string, status: LeadStatus) {
    const lead = await repo.getById(leadId);
    if (!lead || lead.orgId !== orgId) return null;
    return repo.updateStatus(leadId, status);
  }

  async function updateNotes(leadId: string, orgId: string, notes: string) {
    const lead = await repo.getById(leadId);
    if (!lead || lead.orgId !== orgId) return null;
    return repo.updateNotes(leadId, notes);
  }

  return { createLead, listForOrg, updateStatus, updateNotes };
}

export type LeadsService = ReturnType<typeof leadsService>;
