import { useCallback, useEffect, useRef, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { useCurrentWeather, type WeatherSnapshot } from "@/hooks/use-weather";
import { cn } from "@/lib/utils";
import type { DailyLogDay, WeatherCondition } from "@/lib/project-types";

const WEATHER_OPTIONS: { value: WeatherCondition; label: string }[] = [
  { value: "Sunny", label: "Sunny" },
  { value: "Cloudy", label: "Cloudy" },
  { value: "Rain", label: "Rain" },
  { value: "Storm", label: "Storm" },
  { value: "Fog", label: "Fog" },
  { value: "ExtremeHeat", label: "Extreme heat" },
];

export interface UpsertDailyLogValues {
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
}

interface UpsertDailyLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: DailyLogDay | null;
  defaultDate: string;
  projectId: string;
  onSubmit: (values: UpsertDailyLogValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function numOrNull(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function UpsertDailyLogDialog({
  open,
  onOpenChange,
  initial,
  defaultDate,
  projectId,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertDailyLogDialogProps) {
  const [logDate, setLogDate] = useState(defaultDate);
  const [weatherCondition, setWeatherCondition] =
    useState<WeatherCondition | "">("");
  const [temperatureC, setTemperatureC] = useState("");
  const [precipitationMm, setPrecipitationMm] = useState("");
  const [windKph, setWindKph] = useState("");
  const [workersExpected, setWorkersExpected] = useState("");
  const [workersPresent, setWorkersPresent] = useState("");
  const [totalHours, setTotalHours] = useState("");
  const prefilledRef = useRef(false);

  const weather = useCurrentWeather(projectId, open);

  const applyWeather = useCallback((data: WeatherSnapshot) => {
    setWeatherCondition(data.condition);
    setTemperatureC(String(data.temperatureC));
    setWindKph(String(data.windKph));
    setPrecipitationMm(String(data.precipitationMm));
  }, []);

  useEffect(() => {
    if (!open) return;
    setLogDate(initial?.logDate ?? defaultDate);
    setWeatherCondition(initial?.weatherCondition ?? "");
    setTemperatureC(
      initial?.temperatureC !== null && initial?.temperatureC !== undefined
        ? String(initial.temperatureC)
        : "",
    );
    setPrecipitationMm(
      initial?.precipitationMm !== null && initial?.precipitationMm !== undefined
        ? String(initial.precipitationMm)
        : "",
    );
    setWindKph(
      initial?.windKph !== null && initial?.windKph !== undefined
        ? String(initial.windKph)
        : "",
    );
    setWorkersExpected(String(initial?.workersExpected ?? 0));
    setWorkersPresent(String(initial?.workersPresent ?? 0));
    setTotalHours(String(initial?.totalHours ?? 0));
    prefilledRef.current = false;
  }, [open, initial, defaultDate]);

  useEffect(() => {
    if (!open || prefilledRef.current) return;
    if (initial?.weatherCondition) return;
    if (weather.data) {
      applyWeather(weather.data);
      prefilledRef.current = true;
    }
  }, [open, initial, weather.data, applyWeather]);

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(logDate);

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      logDate,
      weatherCondition: weatherCondition || null,
      temperatureC: numOrNull(temperatureC),
      precipitationMm: numOrNull(precipitationMm),
      windKph: numOrNull(windKph),
      workersExpected: Math.max(0, Number(workersExpected) || 0),
      workersPresent: Math.max(0, Number(workersPresent) || 0),
      totalHours: Math.max(0, Number(totalHours) || 0),
    });
  }

  return (
    <FormDrawer open={open}
    onOpenChange={onOpenChange}
    title={initial ? "Update day conditions" : "Set day conditions"}
    submitLabel={initial ? "Save changes" : "Save log"}
    submitDisabled={!isValid}
    submitting={isSubmitting}
    error={error ?? null}
    onSubmit={handleSubmit}><div className="flex flex-col gap-1.5">
      <Label htmlFor="log-date">Date</Label>
      <input
        id="log-date"
        type="date"
        value={logDate}
        onChange={(e) => setLogDate(e.target.value)}
        disabled={!!initial}
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:opacity-60"
      />
    </div>
    
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>Weather</Label>
        {weather.data && (
          <button
            type="button"
            onClick={() => weather.data && applyWeather(weather.data)}
            className="text-xs font-medium text-primary hover:underline"
          >
            ↻ Prefill from live weather
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {WEATHER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setWeatherCondition(opt.value)}
            className={cn(
              "h-9 rounded-full px-3.5 text-xs font-medium transition-colors",
              weatherCondition === opt.value
                ? "bg-[#004DE7] text-white"
                : "bg-[#F6F6F6] text-gray-700 hover:bg-[#EDEDED]",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
    
    <div className="grid grid-cols-3 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="log-temp">Temp °C</Label>
        <input
          id="log-temp"
          type="number"
          value={temperatureC}
          onChange={(e) => setTemperatureC(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="log-rain">Rain mm</Label>
        <input
          id="log-rain"
          type="number"
          min={0}
          value={precipitationMm}
          onChange={(e) => setPrecipitationMm(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="log-wind">Wind kph</Label>
        <input
          id="log-wind"
          type="number"
          min={0}
          value={windKph}
          onChange={(e) => setWindKph(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </div>
    
    <div className="grid grid-cols-3 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="log-expected">Expected crew</Label>
        <input
          id="log-expected"
          type="number"
          min={0}
          value={workersExpected}
          onChange={(e) => setWorkersExpected(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="log-present">Present</Label>
        <input
          id="log-present"
          type="number"
          min={0}
          value={workersPresent}
          onChange={(e) => setWorkersPresent(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="log-hours">Total hours</Label>
        <input
          id="log-hours"
          type="number"
          min={0}
          value={totalHours}
          onChange={(e) => setTotalHours(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </div>
    </FormDrawer>
  );
}

UpsertDailyLogDialog.displayName = "UpsertDailyLogDialog";

export { UpsertDailyLogDialog, type UpsertDailyLogDialogProps };
