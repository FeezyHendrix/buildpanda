import type { Knex } from "knex";

/**
 * The weather assessment the site sees on the project dashboard. Lagos runs a
 * roughly April–October wet season, so rain against the first-floor concrete
 * works is the realistic risk for this fixture rather than heat or wind.
 */
const PROJECT_ID = "sample-project";

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;

  if (!(await knex.schema.hasTable("project_weather_analysis"))) return;
  await knex("project_weather_analysis").where({ project_id: PROJECT_ID }).del();

  const now = new Date();
  await knex("project_weather_analysis").insert({
    id: "wx-seed-1",
    project_id: PROJECT_ID,
    // Deliberately not a forecast hash: the daily cron compares this against
    // the hash of the live forecast, so a placeholder guarantees the first real
    // run replaces the demo text instead of treating it as still current.
    forecast_signature: "seed-demo-lagos-wet-season",
    location_name: "Lagos, Nigeria",
    headline: "Wet-season showers — protect the first-floor deck",
    impact:
      "Lagos is at the tail of the April–October wet season and afternoon storms are still frequent. Exposed rebar, the open slab soffit and fresh block work are the work most at risk this week.",
    schedule_impact:
      "Expect one to two lost days on the first-floor shuttering and slab steel. The structural inspection and anything sequenced behind the pour move with it.",
    cost_impact:
      "Mostly standby: crew and scaffold hire continue while the deck is unworkable, plus rework if a pour is caught by rain. No direct cost has been recorded against the weather yet.",
    recommendations: JSON.stringify([
      "Sheet the open deck and cover tied rebar at the end of each shift.",
      "Book the slab pour into a confirmed dry window and keep the crew on other trades meanwhile.",
      "Keep site drainage and the access road clear so deliveries are not stranded.",
    ]),
    risk_level: "medium",
    // Nothing generated this text, so no model is claimed against it.
    model: null,
    computed_at: now,
    created_at: now,
    updated_at: now,
  });
}
