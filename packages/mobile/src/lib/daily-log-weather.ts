/**
 * The day's weather vocabulary, kept out of the API module on purpose.
 *
 * These are domain values, not transport, and the repository needs the guard at
 * runtime. Importing it from `@/api/daily-logs` pulled in the HTTP client and
 * through it react-native and expo-modules-core, which Node will not type-strip
 * under node_modules — so the daily-logs repository could not be loaded by the
 * RBAC suite at all. `@/api/daily-logs` re-exports all of this, so callers that
 * reach for it there still work.
 */
export const WEATHER_CONDITIONS = [
  "Sunny",
  "Cloudy",
  "Rain",
  "Storm",
  "Fog",
  "ExtremeHeat",
] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

/** Same wording as the web's day form. */
export const WEATHER_CONDITION_LABELS: Record<WeatherCondition, string> = {
  Sunny: "Sunny",
  Cloudy: "Cloudy",
  Rain: "Rain",
  Storm: "Storm",
  Fog: "Fog",
  ExtremeHeat: "Extreme heat",
};

export function isWeatherCondition(value: string | null | undefined): value is WeatherCondition {
  return typeof value === "string" && (WEATHER_CONDITIONS as readonly string[]).includes(value);
}
