import { FieldLabel, Text } from "@/components/atoms";
import { palette } from "@/constants/colors";
import { isIsoDate, localIsoDate } from "@/lib/dates";

interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD`, or "" when no date is set. */
  value: string;
  onChange: (value: string) => void;
  /** Offers "Clear" and a "No date" placeholder. */
  optional?: boolean;
  placeholder?: string;
  minimumDate?: Date;
  error?: string;
}

/**
 * The browser's own date control.
 *
 * The native field renders `@expo/ui`'s picker, whose web build returns null, so
 * on web the calendar never appeared and the field looked like it opened into
 * nothing. `input[type=date]` already speaks `YYYY-MM-DD`, which is the value
 * shape this field has always exchanged.
 */
export function DateField({ label, value, onChange, optional = false, placeholder, minimumDate, error }: DateFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="date"
          aria-label={label}
          value={isIsoDate(value) ? value : ""}
          min={minimumDate ? localIsoDate(minimumDate) : undefined}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          style={{
            flex: 1,
            minHeight: 56,
            padding: "0 16px",
            borderRadius: 12,
            border: `1px solid ${error ? palette.error500 : palette.hairline}`,
            background: palette.surface,
            color: palette.black500,
            font: "inherit",
            fontSize: 14,
          }}
        />
        {optional && isIsoDate(value) ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
            style={{
              minHeight: 56,
              padding: "0 12px",
              border: "none",
              background: "transparent",
              color: palette.primary500,
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {error ? <Text tone="danger" className="text-xs">{error}</Text> : null}
    </div>
  );
}
