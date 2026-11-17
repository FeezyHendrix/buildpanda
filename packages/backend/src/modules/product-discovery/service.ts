import type { ProductDiscoveryRepository } from "./repository.ts";
import {
  DISCOVERY_QUESTIONS,
  type DiscoveryInput,
  type DiscoveryQuestionKey,
  type DiscoveryResponseRow,
  type DiscoveryStatus,
  type DiscoverySummary,
} from "./types.ts";

// Accounts older than the survey are never asked: it is for new signups.
export const ASK_SIGNUPS_FROM = new Date("2026-11-17T00:00:00Z");
const RESPONSE_LIMIT = 300;

const ANSWERS: Record<DiscoveryQuestionKey, (r: DiscoveryResponseRow) => string[]> = {
  useCases: (r) => r.use_cases,
  referralSources: (r) => r.referral_sources,
  currentTools: (r) => r.current_tools,
  role: (r) => (r.role ? [r.role] : []),
  teamSize: (r) => (r.team_size ? [r.team_size] : []),
  activeProjects: (r) => (r.active_projects ? [r.active_projects] : []),
};

export function summarizeDiscovery(rows: DiscoveryResponseRow[]): DiscoverySummary {
  const counts = {} as DiscoverySummary["counts"];
  for (const key of Object.keys(DISCOVERY_QUESTIONS) as DiscoveryQuestionKey[]) {
    counts[key] = DISCOVERY_QUESTIONS[key].map((label) => ({
      label,
      value: rows.filter((r) => ANSWERS[key](r).includes(label)).length,
    }));
  }
  return {
    total: rows.length,
    completed: rows.filter((r) => r.completed_at).length,
    demosBooked: rows.filter((r) => r.demo_booked_at).length,
    counts,
    responses: rows.slice(0, RESPONSE_LIMIT).map((r) => ({
      id: r.user_id,
      name: r.name,
      email: r.email,
      signedUpAt: new Date(r.signed_up_at).toISOString(),
      answeredAt: new Date(r.created_at).toISOString(),
      completed: r.completed_at !== null,
      demoBooked: r.demo_booked_at !== null,
      role: r.role,
      teamSize: r.team_size,
      activeProjects: r.active_projects,
      useCases: r.use_cases,
      referralSources: r.referral_sources,
      currentTools: r.current_tools,
    })),
  };
}

export function productDiscoveryService(repo: ProductDiscoveryRepository) {
  return {
    async status(userId: string): Promise<DiscoveryStatus> {
      const state = await repo.askState(userId);
      const due = state !== undefined && !state.answered && state.createdAt >= ASK_SIGNUPS_FROM;
      return { due, questions: DISCOVERY_QUESTIONS };
    },

    save: (userId: string, input: DiscoveryInput) => repo.upsert(userId, input),

    async adminSummary() {
      const [rows, asked] = await Promise.all([repo.listWithUsers(), repo.signupsSince(ASK_SIGNUPS_FROM)]);
      return { asOf: new Date().toISOString(), asked, ...summarizeDiscovery(rows) };
    },
  };
}
