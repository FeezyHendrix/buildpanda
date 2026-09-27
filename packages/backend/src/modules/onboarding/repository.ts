import type { Knex } from "knex";
import type { OnboardingOrgRow, OnboardingPatch } from "./types.ts";

export interface OnboardingRepository {
  getOrgOnboarding(orgId: string): Promise<(OnboardingOrgRow & { name: string }) | undefined>;
  completeOnboarding(orgId: string, userId: string, patch: OnboardingPatch): Promise<void>;
}

export function onboardingRepository(db: Knex): OnboardingRepository {
  return {
    async getOrgOnboarding(orgId) {
      return db("organization")
        .where({ id: orgId })
        .select("name", "country", "state", "company_size", "usage", "onboarding_completed_at")
        .first();
    },

    async completeOnboarding(orgId, userId, patch) {
      const now = new Date().toISOString();
      // One transaction across both tables: the organization write is what flips
      // the onboarding gate, so were the user write to fail on its own the wizard
      // would never be shown again and the person's name would stay the
      // email-derived placeholder permanently.
      await db.transaction(async (trx) => {
        await trx("organization").where({ id: orgId }).update({
          name: patch.name,
          country: patch.country,
          state: patch.state,
          company_size: patch.company_size,
          usage: JSON.stringify(patch.usage),
          onboarding_completed_at: now,
          updatedAt: now,
        });
        await trx("user")
          .where({ id: userId })
          .update({
            name: patch.userName,
            updatedAt: now,
            ...(patch.userPhone ? { phone: patch.userPhone } : {}),
          });
      });
    },
  };
}
