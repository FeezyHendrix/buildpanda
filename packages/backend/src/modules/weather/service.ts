import type { Knex } from "knex";
import { createHash } from "node:crypto";
import { NotFoundError } from "../../lib/errors.ts";
import { activeModelName, chatJson, isLlmConfigured } from "../../lib/llm.ts";
import {
  fetchWeatherForLocation,
  type WeatherResult,
  type WeatherSnapshot,
} from "../../lib/weather.ts";
import { projectsRepository } from "../projects/repository.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { financesRepository } from "../finances/repository.ts";
import { financesService } from "../finances/service.ts";
import type { ProjectSetup } from "../projects/types.ts";
import { weatherRepository, type WeatherAnalysisRow } from "./repository.ts";
import { generateId } from "../../lib/ids.ts";

export interface WeatherAnalysis {
  available: boolean;
  headline: string | null;
  impact: string | null;
  scheduleImpact: string | null;
  costImpact: string | null;
  recommendations: string[];
  riskLevel: "low" | "medium" | "high" | null;
}

export interface RefreshResult {
  status: "stored" | "skipped_unchanged" | "no_forecast";
}

const UNAVAILABLE: WeatherAnalysis = {
  available: false,
  headline: null,
  impact: null,
  scheduleImpact: null,
  costImpact: null,
  recommendations: [],
  riskLevel: null,
};

function resolveCity(setup: ProjectSetup | null, address: string): string | null {
  const city = setup?.location?.city?.trim();
  if (city) return city;
  const firstSegment = address.split(",")[0]?.trim();
  return firstSegment && firstSegment.length > 1 ? firstSegment : null;
}

function isToday(value: Date | string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return date === today;
}

// Stable fingerprint of the forecast that actually drives the analysis. Keyed on
// the day's date plus the forecast days so the daily cron recomputes (and pays
// for an LLM call) only when the weather outlook has changed since last time.
function forecastSignature(result: WeatherResult): string {
  const basis = {
    day: new Date().toISOString().slice(0, 10),
    location: result.locationName,
    current: result.current,
    forecast: result.forecast,
  };
  return createHash("sha256").update(JSON.stringify(basis)).digest("hex");
}

function rowToAnalysis(row: WeatherAnalysisRow): WeatherAnalysis {
  return {
    available: true,
    headline: row.headline,
    impact: row.impact,
    scheduleImpact: row.schedule_impact,
    costImpact: row.cost_impact,
    recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
    riskLevel: row.risk_level,
  };
}

export function weatherService(db: Knex) {
  const projects = projectsRepository(db);
  const activities = activitiesRepository(db);
  const finances = financesService(financesRepository(db));
  const repo = weatherRepository(db);

  async function load(projectId: string): Promise<WeatherResult | null> {
    const project = await projects.findById(projectId);
    if (!project) throw new NotFoundError("Project");
    const city = resolveCity(project.setup, project.address);
    return fetchWeatherForLocation(city);
  }

  async function current(projectId: string): Promise<WeatherSnapshot | null> {
    const result = await load(projectId);
    return result?.current ?? null;
  }

  async function forecast(projectId: string): Promise<WeatherResult | null> {
    return load(projectId);
  }

  // The expensive path: builds the operational context and asks the LLM to score
  // the weather impact. Only the daily cron and a first-ever cache miss call this
  // — never a routine dashboard view.
  async function computeAnalysis(
    projectId: string,
    result: WeatherResult,
  ): Promise<WeatherAnalysis> {
    const rows = await activities.listByProject(projectId);
    const todays = rows
      .filter((row) => row.status !== "Completed" && row.status !== "Cancelled")
      .filter((row) => isToday(row.planned_start_at) || isToday(row.planned_end_at))
      .slice(0, 20)
      .map((row) => ({
        name: row.name,
        type: row.activity_type,
        status: row.status,
        durationDays: row.duration_days === null ? null : Number(row.duration_days),
        percentComplete: Number(row.percent_complete),
        plannedWorkers: row.worker_count_planned,
        dependents: Array.isArray(row.predecessors) ? row.predecessors.length : 0,
      }));

    const finance = await finances.getByProject(projectId).catch(() => null);
    const nextMilestone = finance?.milestones?.find((m) => m.status !== "Completed");
    const financeContext = finance
      ? {
          currency: finance.currency,
          totalBudget: finance.totalBudget,
          contractSum: finance.contractSum,
          nextMilestone: nextMilestone
            ? { name: nextMilestone.name, amount: nextMilestone.amount, status: nextMilestone.status }
            : null,
        }
      : null;

    if (!isLlmConfigured()) {
      const risky = result.current.condition === "Storm" || result.current.precipitationMm > 5;
      return {
        available: true,
        headline: `${result.current.condition} · ${result.current.temperatureC}°C`,
        impact:
          todays.length === 0
            ? "No activities are scheduled for today."
            : `${todays.length} activit${todays.length === 1 ? "y is" : "ies are"} scheduled today. Review them against current conditions.`,
        scheduleImpact:
          risky && todays.length > 0 ? "Weather-sensitive tasks today may slip; review the schedule." : null,
        costImpact: null,
        recommendations: [],
        riskLevel: risky ? "high" : "low",
      };
    }

    const response = await chatJson([
      {
        role: "system",
        content:
          "You are a construction site operations and cost assistant. Given today's weather, the day's scheduled activities (with durations, % complete, planned worker counts, and number of dependent tasks), and the project finance summary, assess the weather's impact on the work, the SCHEDULE (likely delay in days and any knock-on/cascade to dependent activities), and the COST (qualitative, grounded in the activity durations and budget). " +
          "IMPORTANT: For costImpact, describe the financial exposure qualitatively or as a rough range and reference real drivers (idle/standby crew, equipment hire, milestone payment timing, rework). DO NOT invent a precise currency figure you cannot justify. " +
          "Respond ONLY with strict JSON: {\"headline\": string (<=80 chars), \"impact\": string (<=280 chars), \"scheduleImpact\": string (<=200 chars, mention likely days and cascade), \"costImpact\": string (<=200 chars, qualitative), \"recommendations\": string[] (max 3, each <=120 chars), \"riskLevel\": \"low\"|\"medium\"|\"high\"}. Be specific and practical for a construction crew. If no activities are scheduled, set scheduleImpact and costImpact to short 'No work scheduled' style strings.",
      },
      {
        role: "user",
        content: JSON.stringify({
          weather: {
            condition: result.current.condition,
            temperatureC: result.current.temperatureC,
            windKph: result.current.windKph,
            precipitationMm: result.current.precipitationMm,
          },
          scheduledActivities: todays,
          finance: financeContext,
        }),
      },
    ]);

    const parsed = (response ?? {}) as Partial<WeatherAnalysis> & { recommendations?: unknown };
    const str = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v : null);
    return {
      available: true,
      headline: str(parsed.headline) ?? `${result.current.condition} · ${result.current.temperatureC}°C`,
      impact: str(parsed.impact),
      scheduleImpact: str(parsed.scheduleImpact),
      costImpact: str(parsed.costImpact),
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((r): r is string => typeof r === "string").slice(0, 3)
        : [],
      riskLevel:
        parsed.riskLevel === "low" || parsed.riskLevel === "medium" || parsed.riskLevel === "high"
          ? parsed.riskLevel
          : "low",
    };
  }

  async function store(
    projectId: string,
    result: WeatherResult,
    analysis: WeatherAnalysis,
  ): Promise<void> {
    await repo.upsert(generateId("wx"), {
      projectId,
      forecastSignature: forecastSignature(result),
      locationName: result.locationName,
      analysis,
      model: isLlmConfigured() ? activeModelName() : null,
    });
  }

  // Route path: serve the cached analysis. On a first-ever miss, compute once,
  // persist, and return it (the daily cron keeps it fresh thereafter).
  async function getAnalysis(projectId: string): Promise<WeatherAnalysis> {
    const cached = await repo.latestForProject(projectId);
    if (cached) return rowToAnalysis(cached);

    const result = await load(projectId);
    if (!result) return UNAVAILABLE;
    const analysis = await computeAnalysis(projectId, result);
    await store(projectId, result, analysis);
    return analysis;
  }

  // Cron path: recompute only when the forecast signature has changed since the
  // last stored analysis, so an unchanged outlook costs zero LLM calls.
  async function refreshAnalysis(
    projectId: string,
    options: { force?: boolean } = {},
  ): Promise<RefreshResult> {
    const result = await load(projectId);
    if (!result) return { status: "no_forecast" };

    if (!options.force) {
      const cached = await repo.latestForProject(projectId);
      if (cached && cached.forecast_signature === forecastSignature(result)) {
        return { status: "skipped_unchanged" };
      }
    }

    const analysis = await computeAnalysis(projectId, result);
    await store(projectId, result, analysis);
    return { status: "stored" };
  }

  return { current, forecast, getAnalysis, refreshAnalysis };
}

export type WeatherService = ReturnType<typeof weatherService>;
