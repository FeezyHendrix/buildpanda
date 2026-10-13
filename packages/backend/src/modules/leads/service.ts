import type { LeadsRepository } from "./repository.ts";
import type { LeadStatus, CreateLeadInput } from "./types.ts";
import { generateId } from "../../lib/ids.ts";

// Control characters (other than newline and tab) never belong in a typed
// question; CR/LF are what turn a name into an extra mail header.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g;
const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;

export interface PublicQuestion {
  email: string;
  question: string;
  name?: string;
  /** Hidden from people; a bot that fills every field fills this one. */
  company?: string;
}

/**
 * A question from the public site, cleaned and judged before it is stored or
 * emailed. Returns null for what is plainly not a person asking: the honeypot
 * was filled, or the "question" is a block of links. The caller answers both
 * the same way as a real question, so a bot learns nothing from the reply.
 */
export function cleanPublicQuestion(input: PublicQuestion): { email: string; question: string; name: string | null } | null {
  if (input.company && input.company.trim() !== "") return null;
  const question = input.question.replace(CONTROL, "").replace(/\n{3,}/g, "\n\n").trim();
  const name = (input.name ?? "").replace(CONTROL, "").replace(/[\r\n\t]+/g, " ").replace(/[<>"]/g, "").trim().slice(0, 120);
  const email = input.email.trim().toLowerCase();
  if (question.length < 3) return null;
  if ((question.match(LINK) ?? []).length > 2) return null;
  return { email, question, name: name || null };
}

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
