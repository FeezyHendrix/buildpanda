import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import type { QueueManager } from "../../lib/queue/index.ts";
import { weatherService } from "./service.ts";

export const WEATHER_IMPACT_QUEUE = "weather-impact-sweep";

const INTERVAL_MS = 24 * 60 * 60 * 1_000;

export interface WeatherImpactJobData {
  _tick: number;
}

export interface WeatherImpactSweepResult {
  stored: number;
  skippedUnchanged: number;
  noForecast: number;
  errored: number;
}

export async function runWeatherImpactSweep(db: Knex): Promise<WeatherImpactSweepResult> {
  const service = weatherService(db);
  const projectIds = await db("projects").pluck<string[]>("id");
  const result: WeatherImpactSweepResult = {
    stored: 0,
    skippedUnchanged: 0,
    noForecast: 0,
    errored: 0,
  };

  for (const projectId of projectIds) {
    try {
      const { status } = await service.refreshAnalysis(projectId);
      if (status === "stored") result.stored += 1;
      else if (status === "skipped_unchanged") result.skippedUnchanged += 1;
      else result.noForecast += 1;
    } catch {
      result.errored += 1;
    }
  }

  return result;
}

export function registerWeatherImpactWorker(
  db: Knex,
  manager: QueueManager,
  logger: FastifyBaseLogger,
): void {
  manager.startRepeating<WeatherImpactJobData>(
    WEATHER_IMPACT_QUEUE,
    INTERVAL_MS,
    async () => {
      const summary = await runWeatherImpactSweep(db);
      logger.info({ queue: WEATHER_IMPACT_QUEUE, ...summary }, "weather impact sweep complete");
    },
    { _tick: 0 },
  );
}
