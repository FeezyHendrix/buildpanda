import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/countries";
import whiteLogo from "@/assets/images/logo.white.svg";
import illustration from "@/assets/images/onboarding-illustration.png";
import { Button } from "@/components";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnboardingData {
  // Step 1 — Company Information
  companyName: string;
  country: Country | null;
  state: string | null;
  companySize: string | null;
  // Step 2 — Representative Information
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string; // 2-letter ISO code e.g. "NG"
  phone: string;
  // Step 3 — Use of BuildPanda
  usage: string[];
}

const INITIAL_DATA: OnboardingData = {
  companyName: "",
  country: null,
  state: null,
  companySize: null,
  firstName: "",
  lastName: "",
  email: "",
  phoneCountryCode: "NG",
  phone: "",
  usage: [],
};

// ── Context ───────────────────────────────────────────────────────────────────

interface OnboardingContextValue {
  data: OnboardingData;
  update: (partial: Partial<OnboardingData>) => void;
}

const OnboardingCtx = createContext<OnboardingContextValue | null>(null);

export function useOnboardingContext(): OnboardingContextValue {
  const ctx = useContext(OnboardingCtx);
  if (!ctx) throw new Error("useOnboardingContext must be used within OnboardingLayout");
  return ctx;
}

// ── Step config ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Company Information", path: "/onboarding" },
  { label: "Representative Information", path: "/onboarding/representative" },
  { label: "Use Of BuildPanda", path: "/onboarding/usage" },
] as const;

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path
        d="M1 4L3.5 6.5L9 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function OnboardingLayout() {
  const { pathname } = useLocation();
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);

  const update = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.path === pathname);
  const currentIndex = stepIndex === -1 ? 0 : stepIndex;

  return (
    <OnboardingCtx.Provider value={{ data, update }}>
      <div className="flex h-dvh">
        {/* ── Left panel ───────────────────────────────────────────────── */}
        <div style={{backgroundImage: `url(${illustration})`}} className="relative hidden w-[50%] shrink-0 overflow-hidden bg-white p-12 lg:flex lg:flex-col lg:justify-between bg-cover bg-center bg-no-repeat">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={whiteLogo} alt="BuildPanda Onboarding" className="h-10" />
            </Link>

            <div></div>
          </div>

          {/* Step tracker */}
          <div className="mx-auto w-full pb-10 max-w-[409px]">
            <p className="mb-8 text-h5 font-bold text-white mx-6">
              Step {currentIndex + 1} of {STEPS.length}
            </p>

            <div>
              {STEPS.map((step, i) => {
                const isActive = i === currentIndex;
                const isDone = i < currentIndex;
                const isFirst = i === 0;
                const isLast = i === STEPS.length - 1;
                // Segment connecting step i-1 → step i (above this bullet)
                const aboveYellow = (i - 1) <= currentIndex;
                // Segment connecting step i → step i+1 (below this bullet)
                const belowYellow = i <= currentIndex;

                return (
                  <div key={step.path} className="flex items-center">
                    {/* Left column: line-above + bullet + line-below, stretches to full row height */}
                    <div className="flex w-[11px] flex-none self-stretch flex-col items-center">
                      {/* Line above bullet — empty spacer on first row */}
                      {isFirst
                        ? <div className="flex-1" />
                        : <div className={cn("flex-1 w-px", aboveYellow ? "bg-secondary" : "bg-primary-150")} />
                      }
                      {/* Bullet */}
                      <span
                        className={cn(
                          "h-[11px] w-[11px] shrink-0",
                          isActive || isDone ? "bg-secondary" : "bg-primary-150",
                        )}
                      />
                      {/* Line below bullet — empty spacer on last row */}
                      {isLast
                        ? <div className="flex-1" />
                        : <div className={cn("flex-1 w-px", belowYellow ? "bg-secondary" : "bg-primary-150")} />
                      }
                    </div>

                    {/* Horizontal dash connecting bullet to content */}
                    <span
                      className={cn(
                        "h-px w-6 flex-none",
                        isActive || isDone ? "bg-secondary" : "bg-transparent",
                      )}
                    />

                    {/* Content — yellow bg only on active */}
                    <Button
                      size='lg'
                      className={cn(
                        "flex flex-1 items-center justify-between h-[55px] px-3 transition-colors bg-transparent hover:bg-transparent",
                        isActive ? "bg-secondary hover:bg-secondary" : isDone ? 'bg-white/11 hover:bg-white/11' : 'bg-transparent hover:bg-transparent',
                      )}
                    >
                      <span
                        className={cn(
                          "text-body-s font-semibold",
                          isActive
                            ? "font-semibold text-black-500"
                            : isDone
                              ? "text-secondary"
                              : "text-white/40",
                        )}
                      >
                        {step.label}
                      </span>

                      {isDone && (
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#FFD600] text-[#1A40D6]">
                          <CheckIcon />
                        </span>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div></div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col lg:px-20 lg:py-8 px-2 py-2">
          <main className="flex-1 overflow-y-auto py-8 no-scrollbar">
            <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </OnboardingCtx.Provider>
  );
}
