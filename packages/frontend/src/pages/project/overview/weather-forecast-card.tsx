import { Spinner } from "@/components/atoms/spinner";
import type { WeatherForecast, WeatherForecastDay } from "@/hooks/use-weather";
import type { WeatherCondition } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { OverviewCard } from "./overview-card";

/** Today plus the six days after it. */
const FORECAST_DAYS = 7;

const CONDITION_GLYPH: Record<WeatherCondition, string> = {
  Sunny: "☀️",
  Cloudy: "⛅",
  Rain: "🌧️",
  Storm: "⛈️",
  Fog: "🌫️",
  ExtremeHeat: "🔥",
};

function dayLabel(date: string, index: number): string {
  if (index === 0) return "Today";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { weekday: "short" });
}

function ForecastRow({ day, index }: { day: WeatherForecastDay; index: number }) {
  const isToday = index === 0;
  return (
    <li
      className={cn(
        "flex h-[38px] items-center justify-between border-b border-[#EEEEEE] pl-[12px] pr-[15px] text-[14px] text-[#1E1E1E] last:border-b-0",
        isToday && "border-b-transparent bg-[#E6EDFD] font-semibold",
      )}
    >
      <span className="flex items-center gap-[10px]">
        <span className="w-[18px] text-center text-[18px] leading-none" aria-hidden>
          {CONDITION_GLYPH[day.condition]}
        </span>
        {dayLabel(day.date, index)}
      </span>
      <span className="flex items-center gap-[8px] text-[12px] font-normal tabular-nums text-[#737373]">
        {day.precipitationMm > 0 ? <span>{day.precipitationMm}mm</span> : null}
        <span>{Math.round(day.temperatureMaxC)}°</span>
        <span>{Math.round(day.temperatureMinC)}°</span>
      </span>
    </li>
  );
}

export function WeatherForecastCard({ forecast, isLoading }: { forecast: WeatherForecast | undefined; isLoading: boolean }) {
  const current = forecast?.current;
  const days = forecast?.forecast.slice(0, FORECAST_DAYS) ?? [];

  return (
    <OverviewCard title="Weather" aria-label={forecast?.locationName ? `Weather in ${forecast.locationName}` : undefined}>
      {current ? (
        <div className="flex items-start justify-between gap-3 px-[14px] pb-[17px] pt-[11px]">
          <div>
            <p className="text-[28px] font-semibold leading-[34px] tabular-nums text-[#1E1E1E]">
              {Math.round(current.temperatureC)}°
            </p>
            <p className="mt-[3px] flex gap-[14px] text-[12px] leading-[16px] text-[#737373]">
              <span>
                Wind <span className="font-medium text-[#1E1E1E]">{current.windKph} km/h</span>
              </span>
              <span>
                Rain <span className="font-medium text-[#1E1E1E]">{current.precipitationMm} mm</span>
              </span>
            </p>
          </div>
          <span className="text-[36px] leading-none" aria-hidden>
            {CONDITION_GLYPH[current.condition]}
          </span>
        </div>
      ) : null}
      {isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : (
        <ul className="px-[11px]">
          {days.map((day, index) => (
            <ForecastRow key={day.date} day={day} index={index} />
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

WeatherForecastCard.displayName = "WeatherForecastCard";
