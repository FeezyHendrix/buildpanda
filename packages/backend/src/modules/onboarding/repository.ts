import type { Knex } from "knex";
import type { OnboardingOrgRow } from "./types.ts";

export interface OnboardingRepository {
  getOrgOnboarding(orgId: string): Promise<(OnboardingOrgRow & { name: string }) | undefined>;
  completeOnboarding(
    orgId: string,
    patch: {
      name: string;
      country: string;
      state: string | null;
      company_size: string;
      usage: string[];
    },
  ): Promise<void>;
  updateUserName(userId: string, name: string): Promise<void>;
  updateUserPhone(userId: string, phone: string): Promise<void>;
}

export function onboardingRepository(db: Knex): OnboardingRepository {
  return {
    async getOrgOnboarding(orgId) {
      return db("organization")
        .where({ id: orgId })
        .select("name", "country", "state", "company_size", "usage", "onboarding_completed_at")
        .first();
    },

    async completeOnboarding(orgId, patch) {
      await db("organization")
        .where({ id: orgId })
        .update({
          name: patch.name,
          country: patch.country,
          state: patch.state,
          company_size: patch.company_size,
          usage: JSON.stringify(patch.usage),
          onboarding_completed_at: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
    },

    async updateUserName(userId, name) {
      await db("user").where({ id: userId }).update({ name, updatedAt: new Date().toISOString() });
    },

    async updateUserPhone(userId, phone) {
      await db("user").where({ id: userId }).update({ phone, updatedAt: new Date().toISOString() });
    },
  };
}
