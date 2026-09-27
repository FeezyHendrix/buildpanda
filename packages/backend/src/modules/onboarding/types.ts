export const COMPANY_SIZES = ["Just me", "2-10", "11-50", "51-200", "200+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const USAGE_OPTIONS = [
  "manage-projects",
  "proposals",
  "budgets",
  "site-progress",
  "abroad",
] as const;
export type UsageOption = (typeof USAGE_OPTIONS)[number];

/** Org-level onboarding columns added by migration 20260793. */
export interface OnboardingOrgRow {
  country: string | null;
  state: string | null;
  company_size: string | null;
  usage: string[] | null;
  onboarding_completed_at: Date | null;
}

/** Payload the frontend submits on the final onboarding step. */
export interface OnboardingInput {
  companyName: string;
  country: string;
  state: string | null;
  companySize: string;
  firstName: string;
  lastName: string;
  phoneCountryCode: string;
  phone: string;
  usage: string[];
}

/** The workspace's own onboarding state, as derived from the organization row. */
export interface OnboardingStatus {
  completed: boolean;
  completedAt: string | null;
  companyName: string | null;
  country: string | null;
  state: string | null;
  companySize: string | null;
  usage: string[] | null;
}

/**
 * What GET /v2/onboarding/status returns. `canComplete` is per-caller, not
 * per-workspace: the wizard renames the organization, so only owners/admins may
 * submit it. The client needs it to avoid routing a plain member to a form that
 * would 403 — which would strand them with no way into the app.
 */
export interface OnboardingStatusResponse extends OnboardingStatus {
  canComplete: boolean;
}

export interface OnboardingPatch {
  name: string;
  country: string;
  state: string | null;
  company_size: string;
  usage: string[];
  userName: string;
  userPhone: string | null;
}
