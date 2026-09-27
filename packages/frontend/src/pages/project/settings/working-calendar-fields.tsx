import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

interface WorkingCalendarFieldsProps {
  workingDays: number[];
  holidays: string[];
  disabled: boolean;
  onChangeWorkingDays: (days: number[]) => void;
  onChangeHolidays: (dates: string[]) => void;
}

/**
 * The single biggest gap for a road job: every "working days missed" and
 * "days logged" figure assumed a calendar nobody could see or set, so Sunday
 * counted as a missed report (findings F4, #33).
 */
function WorkingCalendarFields({
  workingDays,
  holidays,
  disabled,
  onChangeWorkingDays,
  onChangeHolidays,
}: WorkingCalendarFieldsProps) {
  const [holidayDraft, setHolidayDraft] = useState("");

  function toggleDay(day: number): void {
    const next = workingDays.includes(day)
      ? workingDays.filter((value) => value !== day)
      : [...workingDays, day].sort((a, b) => a - b);
    // A calendar with no working days makes every figure meaningless.
    if (next.length === 0) return;
    onChangeWorkingDays(next);
  }

  function addHoliday(): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDraft)) return;
    if (holidays.includes(holidayDraft)) return;
    onChangeHolidays([...holidays, holidayDraft].sort());
    setHolidayDraft("");
  }

  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-line-hair pt-5">
      <div className="flex flex-col gap-1.5">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => {
            const on = workingDays.includes(day.value);
            return (
              <Button
                key={day.value}
                type="button"
                size="sm"
                disabled={disabled}
                aria-pressed={on}
                variant={on ? "primary" : "secondary"}
                onClick={() => toggleDay(day.value)}
              >
                {on ? "✓ " : ""}
                {day.label}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          Days the site works. Missed daily logs, durations and extensions of time are all
          counted in these days.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="holiday-date">Holidays &amp; site closures</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="holiday-date"
            type="date"
            value={holidayDraft}
            disabled={disabled}
            onChange={(event) => setHolidayDraft(event.target.value)}
            className={cn(INPUT_CLASS, "w-48")}
          />
          <Button type="button" variant="secondary" size="md" disabled={disabled || !holidayDraft} onClick={addHoliday}>
            Add closure
          </Button>
        </div>
        {holidays.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {holidays.map((date) => (
              <Badge key={date} tone="neutral" size="sm">
                {formatShortDate(date) || date}
                {disabled ? null : (
                  <button
                    type="button"
                    aria-label={`Remove ${date}`}
                    className="ml-1"
                    onClick={() => onChangeHolidays(holidays.filter((value) => value !== date))}
                  >
                    ×
                  </button>
                )}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No closures recorded.</p>
        )}
      </div>
    </div>
  );
}

WorkingCalendarFields.displayName = "WorkingCalendarFields";

export { WorkingCalendarFields, type WorkingCalendarFieldsProps };
