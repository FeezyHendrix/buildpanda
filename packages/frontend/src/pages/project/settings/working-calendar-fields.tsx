import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { DateInputField } from "@/components/molecules/date-input-field";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

const SECTION_HEADING_CLASS = "text-base font-semibold text-[#1E1E1E]";

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
    <>
      <section aria-labelledby="working-days-heading" className="mt-6">
        <h3 id="working-days-heading" className={SECTION_HEADING_CLASS}>Working Days</h3>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DAYS.map((day) => {
            const on = workingDays.includes(day.value);
            return (
              <Button
                key={day.value}
                type="button"
                variant="outline"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => toggleDay(day.value)}
                className={cn(
                  "h-6 rounded-full px-2.5 text-caption-m! font-medium transition-colors",
                  on ? "border-none bg-primary-50 !text-primary" : "text-gray-600 hover:bg-gray-200",
                )}
              >
                {day.label}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-caption-m! text-gray-500">
          Days the site works. Missed daily logs, durations and extensions of time are all
          counted in these days.
        </p>
      </section>

      <section aria-labelledby="holidays-heading" className="mt-7">
        <h3 id="holidays-heading" className={SECTION_HEADING_CLASS}>Holidays &amp; site closures</h3>
        <div className="mt-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 sm:flex-none sm:basis-[calc(50%-12px)]">
            <DateInputField
              id="holiday-date"
              aria-label="Closure date"
              value={holidayDraft}
              disabled={disabled}
              onChange={setHolidayDraft}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            aria-label="Add closure"
            disabled={disabled}
            onClick={addHoliday}
            className="size-[46px] shrink-0 p-0"
          >
            <Plus className="size-5" />
          </Button>
        </div>
        {holidays.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
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
        ) : null}
      </section>
    </>
  );
}

WorkingCalendarFields.displayName = "WorkingCalendarFields";

export { WorkingCalendarFields, type WorkingCalendarFieldsProps };
