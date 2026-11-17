export type DiscoveryQuestionKey =
  | "useCases"
  | "referralSources"
  | "currentTools"
  | "role"
  | "teamSize"
  | "activeProjects";

export interface AdminProductDiscovery {
  asOf: string;
  /** Signups since the survey went live, whether or not they answered. */
  asked: number;
  total: number;
  completed: number;
  demosBooked: number;
  counts: Record<DiscoveryQuestionKey, { label: string; value: number }[]>;
  responses: {
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
  }[];
}
