import { Badge } from "@/components/atoms/badge";
import { holdPointLabel } from "@/lib/hold-points";

interface HoldPointBadgeProps {
  /** Title of the inspection that is still gating the work. */
  inspectionTitle: string;
  className?: string;
}

/**
 * Read-only marker shown on the work a hold point gates. It states what has not
 * passed; acting on it happens on the inspections page, not here — the person
 * looking at the programme is not the one who records the result.
 */
function HoldPointBadge({ inspectionTitle, className }: HoldPointBadgeProps) {
  const label = holdPointLabel(inspectionTitle);
  return (
    <Badge tone="warning" size="sm" dot className={className} title={label}>
      ⛔ {label}
    </Badge>
  );
}

HoldPointBadge.displayName = "HoldPointBadge";

export { HoldPointBadge, type HoldPointBadgeProps };
