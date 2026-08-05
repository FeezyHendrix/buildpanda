import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useOnboardingContext } from "@/layouts/onboarding-layout";
import { markOnboardingComplete } from "@/lib/route-guards";
import { useCompleteOnboarding } from "@/hooks/use-onboarding";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/atoms/button";
import { icons2 } from "@/assets/icons2/icon2";
import { ReactSVG } from "react-svg";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ProjectsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="11" />
      <path d="M6 7V5a4 4 0 0 1 8 0v2" />
      <line x1="10" y1="11" x2="10" y2="14" />
      <line x1="8.5" y1="12.5" x2="11.5" y2="12.5" />
    </svg>
  );
}

function ProposalsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
      <path d="M2 9h16" />
      <path d="M6 4V2" />
      <path d="M14 4V2" />
    </svg>
  );
}

function BudgetsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v1M10 13v1" />
      <path d="M7.5 8.5A2.5 2.5 0 0 1 10 7a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 2.5-1.5" />
    </svg>
  );
}

function SiteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7" r="3" />
      <path d="M5 18a5 5 0 0 1 10 0" />
      <path d="M3 11h2M15 11h2M10 2v2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M2 10h16" />
      <path d="M10 2a14 14 0 0 1 4 8 14 14 0 0 1-4 8 14 14 0 0 1-4-8 14 14 0 0 1 4-8Z" />
    </svg>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────

const USAGE_OPTIONS = [
  {
    id: "manage-projects",
    label: "Manage Construction Projects",
    description: "Track milestones, payments and inspections.",
    Icon: icons2.crane,
  },
  {
    id: "proposals",
    label: "Create Proposals & Estimates",
    description: "Win more work with professional proposals.",
    Icon: icons2.folderBlack,
  },
  {
    id: "budgets",
    label: "Manage Budgets",
    description: "Track project costs and spending.",
    Icon: icons2.moneyBag,
  },
  {
    id: "site-progress",
    label: "Monitor Site Progress",
    description: "Daily logs, drone updates and inspections.",
    Icon: icons2.builder,
  },
  {
    id: "abroad",
    label: "Build from Abroad",
    description: "Monitor Nigerian projects remotely.",
    Icon: icons2.globe,
  },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8 flex items-center gap-1.5 text-[13px] font-medium text-[#767676] transition-colors hover:text-[#1E1E1E]"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 12L6 8l4-4" />
      </svg>
      Back
    </button>
  );
}

export default function OnboardingUsage() {
  const { data, update } = useOnboardingContext();
  const navigate = useNavigate();
  const { data: sessionData } = authClient.useSession();
  const completeOnboarding = useCompleteOnboarding();
  const { usage } = data;

  function toggle(id: string) {
    update({
      usage: usage.includes(id)
        ? usage.filter((u) => u !== id)
        : [...usage, id],
    });
  }

  function handleComplete() {
    const userId = (sessionData?.user as { id?: string } | undefined)?.id;

    completeOnboarding.mutate(
      {
        companyName: data.companyName,
        country: data.country?.code ?? "",
        state: data.state,
        companySize: data.companySize ?? "",
        firstName: data.firstName,
        lastName: data.lastName,
        phoneCountryCode: data.phoneCountryCode,
        phone: data.phone,
        usage: data.usage,
      },
      {
        onSuccess: () => {
          // Keep the localStorage fallback so the guard works even if the
          // status query hasn't settled yet on the next navigation.
          if (userId) markOnboardingComplete(userId);
          navigate("/dashboard");
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err, "Could not save onboarding data"));
        },
      },
    );
  }

  return (
    <div>
      <BackButton onClick={() => navigate("/onboarding/representative")} />

      <h4 className="font-heading text-h4 font-bold text-black-500">
        How will you use BuildPanda?
      </h4>
      <p className="mt-2 text-caption-l font-medium text-grey-450">
        Choose the option(s) that best matches your workflow
      </p>

      <div className="mt-8 space-y-3">
        {USAGE_OPTIONS.map(({ id, label, description, Icon }) => {
          const selected = usage.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={cn(
                "flex w-full flex-col items-start gap-4 border p-6 text-left transition-colors",
                selected
                  ? "border-none bg-primary-50"
                  : "border border-border bg-white hover:border-border hover:bg-transparent",
              )}
            >
              {/* Icon */}
              <ReactSVG
                src={Icon}
                className={cn("transition-colors", selected ? "[&_path]:fill-primary" : "[&_path]:fill-black")}
              />

              {/* Text */}
              <span className="flex flex-col gap-2">
                <span
                  className={cn(
                    "text-body-s font-semibold",
                    selected ? "text-primary" : "text-black-500",
                  )}
                >
                  {label}
                </span>
                <span className={cn("text-text-caption-l", selected ? "text-primary" : "text-grey-450")}>{description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-10">
        <Button
          className="w-full h-[46px] disabled:bg-grey-50 disabled:text-black-500"
          disabled={usage.length === 0}
          loading={completeOnboarding.isPending}
          onClick={handleComplete}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
