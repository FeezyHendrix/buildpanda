// The stored value of an answer is the label itself, so Watchtower reads it without a lookup.
// shortcut: rewording an option splits its history, so add a new option instead of renaming one that has answers.
export const DISCOVERY_QUESTIONS = {
  useCases: [
    "Estimating and take-offs",
    "Proposals and tenders",
    "Programme and scheduling",
    "Site reports and daily logs",
    "Budgets, payments and valuations",
    "Drawings, documents and RFIs",
    "Materials and procurement",
    "Coordinating my team and subcontractors",
    "Keeping clients updated",
    "Monitoring my own build remotely",
    "Just exploring",
  ],
  referralSources: [
    "Google search",
    "LinkedIn",
    "Instagram",
    "X (Twitter)",
    "Facebook",
    "YouTube",
    "TikTok",
    "WhatsApp",
    "ChatGPT or another AI assistant",
    "A friend or colleague",
    "Invited to a project",
    "An event or conference",
    "A blog, article or newsletter",
    "The BuildPanda team reached out",
    "Somewhere else",
  ],
  role: [
    "Owner or director",
    "Project manager",
    "Quantity surveyor or estimator",
    "Site engineer or supervisor",
    "Architect or designer",
    "Procurement or finance",
    "Client or developer",
    "Something else",
  ],
  teamSize: ["Just me", "2-10", "11-50", "51-200", "200+"],
  activeProjects: ["None yet", "1", "2-5", "6-20", "More than 20"],
  currentTools: [
    "Excel or Google Sheets",
    "WhatsApp",
    "Pen and paper",
    "Email",
    "MS Project or Primavera",
    "Other construction software",
    "Accounting software",
    "Nothing yet",
  ],
} as const;

export type DiscoveryQuestionKey = keyof typeof DISCOVERY_QUESTIONS;

export interface DiscoveryInput {
  useCases?: string[];
  referralSources?: string[];
  currentTools?: string[];
  role?: string;
  teamSize?: string;
  activeProjects?: string;
  /** The user answered the last question, as opposed to closing the survey early. */
  completed?: boolean;
  demoBooked?: boolean;
}

export interface DiscoveryStatus {
  due: boolean;
  questions: typeof DISCOVERY_QUESTIONS;
}

export interface DiscoveryAskState {
  createdAt: Date;
  answered: boolean;
}

/** A response joined to the user who gave it. */
export interface DiscoveryResponseRow {
  user_id: string;
  name: string;
  email: string;
  signed_up_at: Date;
  use_cases: string[];
  referral_sources: string[];
  current_tools: string[];
  role: string | null;
  team_size: string | null;
  active_projects: string | null;
  completed_at: Date | null;
  demo_booked_at: Date | null;
  created_at: Date;
}

export interface DiscoveryResponse {
  id: string;
  name: string;
  email: string;
  signedUpAt: string;
  answeredAt: string;
  completed: boolean;
  demoBooked: boolean;
  role: string | null;
  teamSize: string | null;
  activeProjects: string | null;
  useCases: string[];
  referralSources: string[];
  currentTools: string[];
}

export interface DiscoverySummary {
  total: number;
  completed: number;
  demosBooked: number;
  counts: Record<DiscoveryQuestionKey, { label: string; value: number }[]>;
  responses: DiscoveryResponse[];
}
