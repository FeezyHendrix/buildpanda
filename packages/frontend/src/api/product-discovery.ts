import api from "./client";

export type DiscoveryQuestionKey =
  | "useCases"
  | "referralSources"
  | "currentTools"
  | "role"
  | "teamSize"
  | "activeProjects";

export interface DiscoveryStatus {
  /** True for a new signup who has not been asked yet. */
  due: boolean;
  questions: Record<DiscoveryQuestionKey, string[]>;
}

export interface DiscoveryInput {
  useCases?: string[];
  referralSources?: string[];
  currentTools?: string[];
  role?: string;
  teamSize?: string;
  activeProjects?: string;
  completed?: boolean;
  demoBooked?: boolean;
}

export const productDiscoveryApi = {
  status: () => api.get<DiscoveryStatus>("/product-discovery").then((r) => r.data),
  save: (body: DiscoveryInput) => api.put<{ ok: boolean }>("/product-discovery", body).then((r) => r.data),
};
