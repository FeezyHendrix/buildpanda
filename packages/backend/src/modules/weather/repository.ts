import type { Knex } from "knex";
import type { WeatherAnalysis } from "./service.ts";

export interface WeatherAnalysisRow {
  id: string;
  project_id: string;
  forecast_signature: string;
  location_name: string | null;
  headline: string | null;
  impact: string | null;
  schedule_impact: string | null;
  cost_impact: string | null;
  recommendations: string[];
  risk_level: "low" | "medium" | "high" | null;
  model: string | null;
  computed_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface StoreWeatherAnalysis {
  projectId: string;
  forecastSignature: string;
  locationName: string | null;
  analysis: WeatherAnalysis;
  model: string | null;
}

export function weatherRepository(db: Knex) {
  return {
    async listProjectIds(): Promise<string[]> {
      const rows = await db("projects").select("id");
      return rows.map((r: { id: string }) => r.id);
    },

    latestForProject(projectId: string): Promise<WeatherAnalysisRow | undefined> {
      return db<WeatherAnalysisRow>("project_weather_analysis")
        .where({ project_id: projectId })
        .first();
    },

    async upsert(id: string, record: StoreWeatherAnalysis): Promise<void> {
      const now = new Date();
      await db("project_weather_analysis")
        .insert({
          id,
          project_id: record.projectId,
          forecast_signature: record.forecastSignature,
          location_name: record.locationName,
          headline: record.analysis.headline,
          impact: record.analysis.impact,
          schedule_impact: record.analysis.scheduleImpact,
          cost_impact: record.analysis.costImpact,
          recommendations: JSON.stringify(record.analysis.recommendations),
          risk_level: record.analysis.riskLevel,
          model: record.model,
          computed_at: now,
          created_at: now,
          updated_at: now,
        })
        .onConflict("project_id")
        .merge({
          forecast_signature: record.forecastSignature,
          location_name: record.locationName,
          headline: record.analysis.headline,
          impact: record.analysis.impact,
          schedule_impact: record.analysis.scheduleImpact,
          cost_impact: record.analysis.costImpact,
          recommendations: JSON.stringify(record.analysis.recommendations),
          risk_level: record.analysis.riskLevel,
          model: record.model,
          computed_at: now,
          updated_at: now,
        });
    },
  };
}

export type WeatherRepository = ReturnType<typeof weatherRepository>;
