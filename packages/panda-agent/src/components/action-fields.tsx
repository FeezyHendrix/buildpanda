import { INPUT_BASE_CLASS, Input } from "@field-ui/input";
import type { ProposalAction, AgentSession } from "../api/agent";

const weather = ["Sunny", "Cloudy", "Rain", "Storm", "Fog", "ExtremeHeat"];
const numberFields = [
  ["workersExpected", "Workers expected", 5000], ["workersPresent", "Workers present", 5000],
  ["totalHours", "Total hours", 100000], ["temperatureC", "Temperature (°C)", undefined],
  ["precipitationMm", "Precipitation (mm)", undefined], ["windKph", "Wind (km/h)", undefined],
] as const;

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function ActionFields({ action, session, disabled, onChange }: {
  action: ProposalAction;
  session: AgentSession;
  disabled: boolean;
  onChange: (payload: Record<string, unknown>) => void;
}) {
  const payload = action.payload;
  const patch = (field: string, value: unknown) => onChange({ ...payload, [field]: value });
  const textKey = action.kind === "daily_log" ? "bodyText" : "summary";

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-4 text-sm font-semibold">{action.title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Work date
          <Input className="mt-2" type="date" required value={stringValue(payload.logDate)} onChange={(event) => patch("logDate", event.target.value)} />
        </label>
        <label className="block text-sm font-medium">Building
          <Input className="mt-2" readOnly value={session.buildings.find((building) => building.id === payload.buildingId)?.name ?? "Building unavailable"} />
        </label>
      </div>
      <label className="block text-sm font-medium">{action.kind === "daily_log" ? "Site note" : "Daily summary"}
        <textarea aria-label={action.kind === "daily_log" ? "Site note" : "Daily summary"} className={`${INPUT_BASE_CLASS} mt-2 min-h-28 resize-y p-4`} value={stringValue(payload[textKey])} onChange={(event) => patch(textKey, event.target.value)} required={action.kind === "daily_log"} maxLength={action.kind === "daily_log" ? 20000 : 4000} />
      </label>
      {action.kind === "update_daily_log" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Weather
            <select className={`${INPUT_BASE_CLASS} mt-2 min-h-14 px-4`} value={stringValue(payload.weatherCondition)} onChange={(event) => patch("weatherCondition", event.target.value || null)}>
              <option value="">Not recorded</option>
              {weather.map((condition) => <option key={condition} value={condition}>{condition === "ExtremeHeat" ? "Extreme heat" : condition}</option>)}
            </select>
          </label>
          {numberFields.map(([field, label, maximum]) => (
            <label key={field} className="block text-sm font-medium">{label}
              <Input className="mt-2" type="number" step={field.startsWith("workers") ? "1" : "any"} min={field === "temperatureC" ? undefined : 0} max={maximum} value={stringValue(payload[field])} onChange={(event) => {
                if (event.target.value === "") {
                  const next = { ...payload };
                  delete next[field];
                  onChange(next);
                } else patch(field, Number(event.target.value));
              }} />
            </label>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
