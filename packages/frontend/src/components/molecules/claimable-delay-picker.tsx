import { Badge } from "@/components/atoms/badge";
import { Label } from "@/components/atoms/label";
import { CULPABILITY_META, totalDaysLost, workingDaysLabel } from "@/lib/delay-meta";
import type { ClaimableDelay } from "@/lib/delay-meta";
import { formatShortDate } from "@/lib/formatters";
import type { Culpability } from "@/lib/project-types";

/**
 * A time claim is argued from delays, not typed from memory. The picker offers
 * only the EOT-claimable ones, because the server refuses a claim citing a
 * contractor-culpable delay and names it.
 */

function DelayOption({
  item,
  checked,
  onToggle,
}: {
  item: ClaimableDelay;
  checked: boolean;
  onToggle: () => void;
}) {
  const meta = CULPABILITY_META[item.delay.culpability as Culpability] ?? CULPABILITY_META.neutral;
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-surface-alt">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 accent-primary-500"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{item.activityName}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>{item.delay.reasonName}</span>
            <span>·</span>
            <span>{formatShortDate(item.delay.startedAt)}</span>
            <span>·</span>
            <span className="tabular-nums">{workingDaysLabel(item.delay.daysLost)}</span>
            <Badge tone={meta.tone} size="sm">
              {meta.glyph} {meta.short}
            </Badge>
          </span>
        </span>
      </label>
    </li>
  );
}

DelayOption.displayName = "DelayOption";

interface ClaimableDelayPickerProps {
  delays: ClaimableDelay[];
  selected: ReadonlySet<string>;
  onToggle: (delayId: string) => void;
}

export function ClaimableDelayPicker({ delays, selected, onToggle }: ClaimableDelayPickerProps) {
  const citedDays = totalDaysLost(delays, selected);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="cr-delays">Delays claimed against</Label>
      {delays.length === 0 ? (
        <p id="cr-delays" className="rounded-lg bg-surface-alt p-3 text-sm text-ink-muted">
          No claimable delays yet. A delay becomes claimable when it is the client&rsquo;s risk or a
          neutral event — a contractor-culpable delay never is.
        </p>
      ) : (
        <>
          <ul
            id="cr-delays"
            className="max-h-64 divide-y divide-line-hair overflow-y-auto rounded-lg border border-line-hair"
          >
            {delays.map((item) => (
              <DelayOption
                key={item.delay.id}
                item={item}
                checked={selected.has(item.delay.id)}
                onToggle={() => onToggle(item.delay.id)}
              />
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            {selected.size > 0
              ? `The delays you have cited lost ${workingDaysLabel(citedDays)}.`
              : "Cite the delays the claim is argued from — an unargued claim is refused."}
          </p>
        </>
      )}
    </div>
  );
}

ClaimableDelayPicker.displayName = "ClaimableDelayPicker";
