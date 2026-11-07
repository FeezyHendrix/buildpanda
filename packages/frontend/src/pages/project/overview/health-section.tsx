import { Link } from "react-router-dom";
import { Spinner } from "@/components/atoms/spinner";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import type { AiSuggestion } from "@/hooks/use-panda-ai";
import { cn } from "@/lib/utils";
import { OverviewCard } from "./overview-card";

/** The design shows four recommendations; more than that is a to-do list, not a dashboard. */
const SUGGESTION_LIMIT = 4;
const GAUGE_SIZE = 182;
const GAUGE_STROKE = 9;
const PRIORITY_RANK: Record<AiSuggestion["priority"], number> = { high: 3, medium: 2, low: 1 };

const PRIORITY_DOT: Record<AiSuggestion["priority"], string> = {
  high: "bg-[#B91C1C]",
  medium: "bg-amber-500",
  low: "bg-primary",
};

function healthColor(score: number | null): string {
  if (score === null) return "#D0D5DD";
  if (score >= 80) return "#16A34A";
  if (score >= 50) return "#D97706";
  return "#B91C1C";
}

function suggestionLink(projectId: string, category: string): string {
  switch (category) {
    case "Budget":
      return `/project/${projectId}/budget`;
    case "Finance":
      return `/project/${projectId}/finances`;
    case "Schedule":
      return `/project/${projectId}/schedules/stages`;
    default:
      return `/project/${projectId}/panda-ai`;
  }
}

function formatSuggestionTitle(title: string): string {
  return title.replace("1 inspection need action", "1 inspection needs action");
}

function HealthGauge({ score }: { score: number | null }) {
  const radius = (GAUGE_SIZE - GAUGE_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const color = healthColor(score);

  return (
    <div className="relative" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }} role="img" aria-label={`Health score ${score ?? "not yet available"} out of 100`}>
      <svg width={GAUGE_SIZE} height={GAUGE_SIZE} className="-rotate-90">
        <circle cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2} r={radius} fill="white" stroke="#E8E8E8" strokeWidth={GAUGE_STROKE} />
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={GAUGE_STROKE}
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-baseline justify-center pt-[68px]">
        <span className="text-[34px] font-bold leading-[40px]" style={{ color }}>
          {score ?? "--"}
        </span>
        <span className="text-[14px] font-medium leading-[20px] text-[#A3A3A3]">/100</span>
      </div>
    </div>
  );
}

function SuggestionRow({ suggestion, projectId }: { suggestion: AiSuggestion; projectId: string }) {
  return (
    <li className="border-b border-[#EEEEEE] last:border-b-0">
      <Link
        to={suggestionLink(projectId, suggestion.category)}
        className="group flex items-center gap-[12px] px-[16px] py-[8px] hover:bg-[#FAFAFA]"
      >
        <span className={cn("size-[7px] shrink-0 rounded-full", PRIORITY_DOT[suggestion.priority])} />
        <span className="min-w-0">
          <span className="block truncate text-[14px] leading-[20px] text-[#1E1E1E] group-hover:text-primary">
            {formatSuggestionTitle(suggestion.title)}
          </span>
          <span className="block text-[12px] leading-[16px] text-[#A3A3A3]">{suggestion.category}</span>
        </span>
      </Link>
    </li>
  );
}

function PanelMessage({ children }: { children: string }) {
  return <p className="rounded-none bg-white px-[16px] py-[24px] text-[14px] text-[#737373]">{children}</p>;
}

/** Health score gauge and the Panda AI recommendations that explain it. */
export function HealthSection({ projectId, className }: { projectId: string; className?: string }) {
  const { data, isPending, isError } = useReportingSnapshot(projectId);
  const health = data?.health;
  const isEmpty = health ? health.score === null && health.suggestions.length === 0 : false;
  const suggestions = health
    ? [...health.suggestions].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]).slice(0, SUGGESTION_LIMIT)
    : [];

  return (
    <section
      aria-label="Project health"
      className={cn("grid grid-cols-1 gap-[23px] lg:grid-cols-[minmax(0,281fr)_minmax(0,727fr)]", className)}
    >
      <OverviewCard title="Health Score">
        <div className="flex min-h-[248px] flex-1 items-center justify-center bg-[#F6F6F6] py-[33px]">
          {isPending ? <Spinner size="md" /> : <HealthGauge score={health?.score ?? null} />}
        </div>
      </OverviewCard>

      <OverviewCard title="Recommended Actions">
        <div className="flex flex-1 flex-col bg-[#F6F6F6] p-[14px]">
          {isPending ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : isError || !health ? (
            <PanelMessage>Reporting temporarily unavailable</PanelMessage>
          ) : isEmpty ? (
            <PanelMessage>Panda AI will analyse this project shortly.</PanelMessage>
          ) : suggestions.length === 0 ? (
            <PanelMessage>No urgent priorities right now.</PanelMessage>
          ) : (
            <ul className="border border-[#EEEEEE] bg-white">
              {suggestions.map((suggestion) => (
                <SuggestionRow key={`${suggestion.category}:${suggestion.title}`} suggestion={suggestion} projectId={projectId} />
              ))}
            </ul>
          )}
        </div>
      </OverviewCard>
    </section>
  );
}

HealthSection.displayName = "HealthSection";
