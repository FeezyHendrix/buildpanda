import { api } from "./client";

export interface OnboardingStatus {
  completed: boolean;
  completedAt: string | null;
  companyName: string | null;
  country: string | null;
  state: string | null;
  companySize: string | null;
  usage: string[] | null;
}

export interface CompleteOnboardingInput {
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

export const onboardingApi = {
  status: () =>
    api.get<OnboardingStatus>("/v2/onboarding/status").then((r) => r.data),
  complete: (body: CompleteOnboardingInput) =>
    api.post<OnboardingStatus>("/v2/onboarding", body).then((r) => r.data),
};
