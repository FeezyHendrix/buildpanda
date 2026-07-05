import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import {
  useWeatherAnalysis,
  useWeatherForecast,
  type WeatherForecastDay,
} from "@/hooks/use-weather";
import type { WeatherCondition } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { EmptyState } from "../molecules";

const CONDITION_GLYPH: Record<WeatherCondition, string> = {
  Sunny: "☀️",
  Cloudy: "⛅",
  Rain: "🌧️",
  Storm: "⛈️",
  Fog: "🌫️",
  ExtremeHeat: "🔥",
};

const RISK_STYLE: Record<"low" | "medium" | "high", string> = {
  low: "bg-success-50 text-success-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

function dayLabel(date: string, index: number): string {
  if (index === 0) return "Today";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { weekday: "short" });
}

function ForecastRow({
  day,
  index,
}: {
  day: WeatherForecastDay;
  index: number;
}) {
  const isToday = index === 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[10px] px-3 py-2",
        isToday ? "bg-white/15" : "",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[18px] leading-none">
          {CONDITION_GLYPH[day.condition]}
        </span>
        <span
          className={cn(
            "text-[12px]",
            isToday ? "font-semibold text-white" : "text-white/85",
          )}
        >
          {dayLabel(day.date, index)}
        </span>
      </div>
      <div className="flex items-center gap-2 tabular-nums">
        {day.precipitationMm > 0 && (
          <span className="text-[10px] font-medium text-white/60">
            {day.precipitationMm}mm
          </span>
        )}
        <span className="text-[12px] font-bold text-white">
          {Math.round(day.temperatureMaxC)}°
        </span>
        <span className="text-[11px] text-white/60">
          {Math.round(day.temperatureMinC)}°
        </span>
      </div>
    </div>
  );
}

export function WeatherDashboard({ projectId }: { projectId: string }) {
  const forecast = useWeatherForecast(projectId);
  const analysis = useWeatherAnalysis(projectId);

  const current = forecast.data?.current;
  const days = forecast.data?.forecast ?? [];
  const hasWeather = Boolean(current) && days.length > 0;

  if (!forecast.isLoading && !hasWeather) return null;

  return (
    <section
      aria-label="Weather"
      className="grid grid-cols-1 gap-4 lg:grid-cols-4"
    >
      <Card
        padding="md"
        className="overflow-hidden rounded-[16px] border-none bg-primary p-5 text-white lg:col-span-1"
        style={{
          backgroundImage:
            "radial-gradient(130% 130% at 100% 0%, #3371EE 0%, #004DE7 50%, #0046D2 100%)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/70">
              Weather
            </p>
            {forecast.data?.locationName && (
              <p className="mt-0.5 text-[14px] font-semibold">
                {forecast.data.locationName}
              </p>
            )}
          </div>
          {current && (
            <span className="text-[36px] leading-none drop-shadow-sm">
              {CONDITION_GLYPH[current.condition]}
            </span>
          )}
        </div>

        {current && (
          <div className="mt-2">
            <p className="text-[40px] font-bold leading-none tabular-nums">
              {Math.round(current.temperatureC)}°
            </p>
            <p className="mt-1 text-[12px] text-white/80">
              {current.condition}
            </p>
            <div className="mt-2 flex gap-4 text-[11px] text-white/70">
              <span>
                Wind{" "}
                <span className="font-semibold text-white">
                  {current.windKph} km/h
                </span>
              </span>
              <span>
                Rain{" "}
                <span className="font-semibold text-white">
                  {current.precipitationMm} mm
                </span>
              </span>
            </div>
          </div>
        )}

        {forecast.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-0.5 border-t border-white/15 pt-3">
            {days.slice(0, 5).map((day, index) => (
              <ForecastRow key={day.date} day={day} index={index} />
            ))}
          </div>
        )}
      </Card>

      <Card
        padding="md"
        className="rounded-[16px] border-none bg-[#F8F8F8] p-5 flex flex-col px-0 py-0 lg:col-span-3"
      >
        <div className="flex items-center justify-between py-3 px-5">
          <div className="flex gap-2 items-center">
            <ReactSVG src={icons.globe} />
            <h3 className="text-[13px] font-semibold text-black-300">
              Panda AI Weather Impact
            </h3>
          </div>
          {analysis.data?.riskLevel && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                RISK_STYLE[analysis.data.riskLevel],
              )}
            >
              {analysis.data.riskLevel} risk
            </span>
          )}
        </div>
        <div className="bg-white rounded-[12px] h-full m-1 p-6 flex items-center">
          {analysis.isLoading ? (
            <div className="flex h-28 items-center justify-center w-full">
              <Spinner size="sm" />
            </div>
          ) : analysis.data?.available ? (
            <div className="mt-4 flex flex-col gap-4 justify-center w-full">
              <div className="text-center">
                {analysis.data.headline && (
                  <p className="text-[16px] font-semibold leading-snug text-black-500">
                    {analysis.data.headline}
                  </p>
                )}
                {analysis.data.impact && (
                  <p className="mt-1.5 mx-auto max-w-3xl text-[13px] leading-relaxed text-black-300">
                    {analysis.data.impact}
                  </p>
                )}
              </div>

              {(analysis.data.scheduleImpact || analysis.data.costImpact) && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {analysis.data.scheduleImpact && (
                    <div className="flex flex-col gap-4 rounded-tl-[16px] rounded-bl-[16px] border border-[#F6F6F6] p-6">
                      <div className="mb-1 flex items-center gap-1.5">
                        <ReactSVG
                          src={icons.calendarSearch}
                          className="[&_svg]:size-3.5 [&_svg]:opacity-60"
                        />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-black-300">
                          Schedule impact
                        </p>
                      </div>
                      <p className="text-[13px] leading-snug text-black-500">
                        {analysis.data.scheduleImpact}
                      </p>
                    </div>
                  )}
                  {analysis.data.costImpact && (
                    <div className="flex flex-col gap-4 rounded-tr-[16px] rounded-br-[16px] border border-[#F6F6F6] p-6">
                      <div className="mb-1 flex items-center gap-1.5">
                        <ReactSVG
                          src={icons.wallet}
                          className="[&_svg]:size-3.5 [&_svg]:opacity-60"
                        />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-black-300">
                          Cost impact
                        </p>
                      </div>
                      <p className="text-[13px] leading-snug text-black-500">
                        {analysis.data.costImpact}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {analysis.data.recommendations.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black-300">
                    Recommended actions
                  </p>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-wrap">
                    {analysis.data.recommendations.map((rec, idx) => (
                      <div
                        key={rec}
                        className="flex items-center gap-3 rounded-[16px] bg-[#F6F6F6] py-1 px-1"
                      >
                        <span className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-primary">
                          {idx + 1}
                        </span>
                        <p className="text-[13px] leading-snug text-black-500">
                          {rec}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No scheduled activities today due to weather"
              // icon={(<ReactSVG src={icons.riskShield} />)}
              description="Weather analysis is unavailable right now"
              className="py-6"
            />
          )}
        </div>
      </Card>
    </section>
  );
}
