import type { WeatherCondition } from "../modules/daily-logs/types.ts";
import { logger } from "./logger.ts";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 8000;

export interface WeatherSnapshot {
  condition: WeatherCondition;
  temperatureC: number;
  windKph: number;
  precipitationMm: number;
}

export interface WeatherForecastDay {
  date: string;
  condition: WeatherCondition;
  conditionLabel: string;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationMm: number;
  windKph: number;
}

export interface WeatherResult {
  locationName: string;
  current: WeatherSnapshot;
  forecast: WeatherForecastDay[];
}

// WMO weather interpretation codes (https://open-meteo.com/en/docs) collapsed to
// the app's WeatherCondition enum. Temperature promotes hot-but-clear days to
// ExtremeHeat so the daily log flags heat-stress conditions.
function wmoToCondition(code: number, temperatureC: number): WeatherCondition {
  if (temperatureC >= 35) return "ExtremeHeat";
  if (code === 0) return "Sunny";
  if (code <= 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 95) return "Storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Storm";
  return "Cloudy";
}

const WMO_LABEL: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

function conditionLabel(code: number): string {
  return WMO_LABEL[code] ?? "Cloudy";
}

async function getJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch (error) {
    logger.warn({ err: error, url }, "[weather] request failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
}

async function geocode(city: string, countryCode: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({ name: city, count: "1", countryCode });
  const data = (await getJson(`${GEOCODE_URL}?${params.toString()}`)) as
    | { results?: GeoResult[] }
    | null;
  return data?.results?.[0] ?? null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function fetchWeatherForLocation(
  city: string | null | undefined,
  countryCode = "NG",
): Promise<WeatherResult | null> {
  if (!city || city.trim().length === 0) return null;
  const place = await geocode(city.trim(), countryCode);
  if (!place) return null;

  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,weather_code,wind_speed_10m,precipitation",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "5",
  });
  const data = (await getJson(`${FORECAST_URL}?${params.toString()}`)) as
    | {
        current?: {
          temperature_2m: number;
          weather_code: number;
          wind_speed_10m: number;
          precipitation: number;
        };
        daily?: {
          time: string[];
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_sum: number[];
          wind_speed_10m_max: number[];
        };
      }
    | null;
  if (!data?.current || !data.daily) return null;

  const current: WeatherSnapshot = {
    condition: wmoToCondition(data.current.weather_code, data.current.temperature_2m),
    temperatureC: round1(data.current.temperature_2m),
    windKph: round1(data.current.wind_speed_10m),
    precipitationMm: round1(data.current.precipitation),
  };

  const forecast: WeatherForecastDay[] = data.daily.time.map((date, i) => {
    const code = data.daily!.weather_code[i] ?? 3;
    const max = data.daily!.temperature_2m_max[i] ?? 0;
    return {
      date,
      condition: wmoToCondition(code, max),
      conditionLabel: conditionLabel(code),
      temperatureMaxC: round1(max),
      temperatureMinC: round1(data.daily!.temperature_2m_min[i] ?? 0),
      precipitationMm: round1(data.daily!.precipitation_sum[i] ?? 0),
      windKph: round1(data.daily!.wind_speed_10m_max[i] ?? 0),
    };
  });

  return { locationName: place.name, current, forecast };
}
