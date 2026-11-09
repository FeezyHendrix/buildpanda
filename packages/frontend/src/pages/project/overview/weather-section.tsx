import { useWeatherAnalysis, useWeatherForecast } from "@/hooks/use-weather";
import { cn } from "@/lib/utils";
import { WeatherBriefCard } from "./weather-brief-card";
import { WeatherForecastCard } from "./weather-forecast-card";

/** Current conditions and forecast beside the Panda AI brief for the site. */
export function WeatherSection({ projectId, className }: { projectId: string; className?: string }) {
  const forecast = useWeatherForecast(projectId);
  const analysis = useWeatherAnalysis(projectId);

  const hasWeather = Boolean(forecast.data?.current) && (forecast.data?.forecast.length ?? 0) > 0;
  if (!forecast.isLoading && !hasWeather) return null;

  return (
    <section
      aria-label="Weather"
      className={cn("grid grid-cols-1 gap-[23px] lg:grid-cols-[minmax(0,303fr)_minmax(0,705fr)]", className)}
    >
      <WeatherForecastCard forecast={forecast.data} isLoading={forecast.isLoading} />
      <WeatherBriefCard analysis={analysis.data} isLoading={analysis.isLoading} />
    </section>
  );
}

WeatherSection.displayName = "WeatherSection";
