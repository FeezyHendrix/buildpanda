import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  useWeatherAnalysis,
  useWeatherForecast,
  type WeatherAnalysis,
  type WeatherForecast,
  type WeatherForecastDay,
} from "@/hooks/use-weather";
import type { WeatherCondition } from "@/lib/project-types";

const FORECAST_DAYS = 5;

const CONDITION_LABEL: Record<WeatherCondition, string> = {
  Sunny: "Sunny",
  Cloudy: "Cloudy",
  Rain: "Rain",
  Storm: "Storm",
  Fog: "Fog",
  ExtremeHeat: "Extreme heat",
};

const RISK_META: Record<NonNullable<WeatherAnalysis["riskLevel"]>, { label: string; tone: BadgeTone }> = {
  low: { label: "Low risk", tone: "success" },
  medium: { label: "Medium risk", tone: "warning" },
  high: { label: "High risk", tone: "danger" },
};

function dayLabel(date: string, index: number): string {
  if (index === 0) return "Today";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { weekday: "short" });
}

function LoadingCard() {
  return (
    <Card className="flex min-h-64 items-center justify-center">
      <Spinner size="md" />
    </Card>
  );
}

LoadingCard.displayName = "LoadingCard";

/** Current conditions as a figure, then the next days as a plain table. */
function ForecastCard({ forecast }: { forecast: WeatherForecast }) {
  const current = forecast.current;
  const days = forecast.forecast.slice(0, FORECAST_DAYS);

  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm font-medium text-ink-muted">
        {forecast.locationName ? `Weather · ${forecast.locationName}` : "Weather"}
      </p>
      {current ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-3xl font-medium tabular-nums text-ink">{Math.round(current.temperatureC)}°C</p>
            <p className="text-base font-medium text-ink-muted">{CONDITION_LABEL[current.condition]}</p>
          </div>
          <p className="text-sm text-ink-muted">
            Wind {current.windKph} km/h · Rain {current.precipitationMm} mm
          </p>
        </>
      ) : null}

      <Table bleed wrapperClassName="mt-4">
        <TableHead>
          <tr>
            <TableHeaderCell>Day</TableHeaderCell>
            <TableHeaderCell>Conditions</TableHeaderCell>
            <TableHeaderCell align="right">Rain</TableHeaderCell>
            <TableHeaderCell align="right">High</TableHeaderCell>
            <TableHeaderCell align="right">Low</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {days.map((day, index) => (
            <ForecastRow key={day.date} day={day} index={index} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

ForecastCard.displayName = "ForecastCard";

function ForecastRow({ day, index }: { day: WeatherForecastDay; index: number }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium">{dayLabel(day.date, index)}</TableCell>
      <TableCell className="text-ink-muted">{day.conditionLabel || CONDITION_LABEL[day.condition]}</TableCell>
      <TableCell align="right" className="text-ink-muted">
        {day.precipitationMm > 0 ? `${day.precipitationMm} mm` : "—"}
      </TableCell>
      <TableCell align="right">{Math.round(day.temperatureMaxC)}°</TableCell>
      <TableCell align="right" className="text-ink-muted">
        {Math.round(day.temperatureMinC)}°
      </TableCell>
    </TableRow>
  );
}

ForecastRow.displayName = "ForecastRow";

function ImpactField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase text-ink-muted">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

ImpactField.displayName = "ImpactField";

/** Panda AI's reading of the forecast against the programme. */
function AnalysisCard({ analysis }: { analysis: WeatherAnalysis }) {
  const risk = analysis.riskLevel ? RISK_META[analysis.riskLevel] : null;

  if (!analysis.available) {
    return (
      <Card>
        <p className="text-sm font-medium text-ink-muted">Panda AI weather impact</p>
        <EmptyState
          variant="inline"
          title="No weather-affected activities today"
          description="Weather analysis is unavailable right now."
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">Panda AI weather impact</p>
        {risk ? (
          <Badge tone={risk.tone} dot>
            {risk.label}
          </Badge>
        ) : null}
      </div>

      {analysis.headline ? <p className="text-base font-medium text-ink">{analysis.headline}</p> : null}
      {analysis.impact ? <p className="text-sm text-ink-muted">{analysis.impact}</p> : null}

      {analysis.scheduleImpact || analysis.costImpact ? (
        <div className="grid grid-cols-1 gap-4 border-t border-line-hair pt-4 sm:grid-cols-2">
          {analysis.scheduleImpact ? <ImpactField label="Schedule impact" value={analysis.scheduleImpact} /> : null}
          {analysis.costImpact ? <ImpactField label="Cost impact" value={analysis.costImpact} /> : null}
        </div>
      ) : null}

      {analysis.recommendations.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-line-hair pt-4">
          <p className="text-xs font-medium uppercase text-ink-muted">Recommended actions</p>
          <ol className="flex flex-col gap-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={rec} className="flex gap-3 text-sm text-ink">
                <span className="w-5 shrink-0 tabular-nums text-ink-muted">{index + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Card>
  );
}

AnalysisCard.displayName = "AnalysisCard";

export function WeatherDashboard({ projectId }: { projectId: string }) {
  const forecast = useWeatherForecast(projectId);
  const analysis = useWeatherAnalysis(projectId);

  const hasWeather = Boolean(forecast.data?.current) && (forecast.data?.forecast.length ?? 0) > 0;

  if (!forecast.isLoading && !hasWeather) {
    return (
      <Card>
        <EmptyState
          variant="inline"
          title="No weather data"
          description="Set the project address to see the forecast and Panda AI's weather impact."
        />
      </Card>
    );
  }

  return (
    <section aria-label="Weather" className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
      {forecast.isLoading || !forecast.data ? <LoadingCard /> : <ForecastCard forecast={forecast.data} />}
      {analysis.isLoading || !analysis.data ? <LoadingCard /> : <AnalysisCard analysis={analysis.data} />}
    </section>
  );
}

WeatherDashboard.displayName = "WeatherDashboard";
