import type { OnboardingRepository } from "./repository.ts";
import type { OnboardingInput, OnboardingStatus } from "./types.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { COMPANY_SIZES, USAGE_OPTIONS } from "./types.ts";

function toOnboardingStatus(
  row: { name: string; country: string | null; state: string | null; company_size: string | null; usage: string[] | null; onboarding_completed_at: Date | null } | undefined,
): OnboardingStatus {
  if (!row) {
    return { completed: false, completedAt: null, companyName: null, country: null, state: null, companySize: null, usage: null };
  }
  return {
    completed: row.onboarding_completed_at !== null,
    completedAt: row.onboarding_completed_at?.toISOString?.() ?? (row.onboarding_completed_at as string | null),
    companyName: row.name ?? null,
    country: row.country ?? null,
    state: row.state ?? null,
    companySize: row.company_size ?? null,
    usage: row.usage ?? null,
  };
}

export function onboardingService(repo: OnboardingRepository) {
  return {
    async status(orgId: string): Promise<OnboardingStatus> {
      const row = await repo.getOrgOnboarding(orgId);
      return toOnboardingStatus(row);
    },

    async complete(orgId: string, userId: string, input: OnboardingInput): Promise<OnboardingStatus> {
      if (!input.companyName?.trim()) throw new BadRequestError("Company name is required");
      if (!input.country?.trim()) throw new BadRequestError("Country is required");
      if (!input.companySize?.trim()) throw new BadRequestError("Company size is required");
      if (!input.firstName?.trim()) throw new BadRequestError("First name is required");
      if (!input.lastName?.trim()) throw new BadRequestError("Last name is required");
      if (!Array.isArray(input.usage) || input.usage.length === 0) {
        throw new BadRequestError("At least one usage option is required");
      }

      // Validate enum values
      if (!COMPANY_SIZES.includes(input.companySize as typeof COMPANY_SIZES[number])) {
        throw new BadRequestError(`Invalid company size: ${input.companySize}`);
      }
      const invalidUsage = input.usage.filter((u) => !USAGE_OPTIONS.includes(u as typeof USAGE_OPTIONS[number]));
      if (invalidUsage.length > 0) {
        throw new BadRequestError(`Invalid usage option(s): ${invalidUsage.join(", ")}`);
      }

      // Persist org-level fields + mark complete
      await repo.completeOnboarding(orgId, {
        name: input.companyName.trim(),
        country: input.country.trim(),
        state: input.state?.trim() || null,
        company_size: input.companySize,
        usage: input.usage,
      });

      // Persist user-level fields
      const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`;
      await repo.updateUserName(userId, fullName);
      if (input.phone?.trim()) {
        const phoneWithCode = input.phoneCountryCode
          ? `${input.phoneCountryCode}:${input.phone.trim()}`
          : input.phone.trim();
        await repo.updateUserPhone(userId, phoneWithCode);
      }

      const row = await repo.getOrgOnboarding(orgId);
      return toOnboardingStatus(row);
    },
  };
}
