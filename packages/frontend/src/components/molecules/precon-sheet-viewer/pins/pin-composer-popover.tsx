import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { PinPopover, TEXTAREA_CLASS, type PopoverAnchor } from "@/components/molecules/markup-thread/pin-popover";

/**
 * First comment on a new pin. Text only for now: a take-off note is a sentence
 * and a figure. Audio arrives with mobile measuring; video stays off this
 * surface (the model keeps media_kind either way).
 */
export function PinComposerPopover({
  anchor,
  lineLabel,
  color,
  busy,
  onCancel,
  onSubmit,
}: {
  anchor: PopoverAnchor;
  /** The bill line the pin will attach to, or null for a sheet-only note. */
  lineLabel: string | null;
  color: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: string) => void;
}) {
  const [body, setBody] = useState("");
  const canSubmit = body.trim().length > 0 && !busy;

  function submit(): void {
    if (canSubmit) onSubmit(body.trim());
  }

  return (
    <PinPopover anchor={anchor} title="Add comment" color={color} onClose={onCancel}>
      <p className="mt-1.5 truncate text-[11px] text-gray-500">
        {lineLabel ? `On line: ${lineLabel}` : "Not tied to a bill line — select a line first to attach it"}
      </p>
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Is this partition 225 or 150? The section says 150."
        className={`mt-2 ${TEXTAREA_CLASS}`}
      />
      <div className="mt-2.5 flex items-center gap-2">
        <p className="text-[10px] text-gray-400">⌘↵ to save</p>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" loading={busy} disabled={!canSubmit} onClick={submit}>
          Save comment
        </Button>
      </div>
    </PinPopover>
  );
}
PinComposerPopover.displayName = "PinComposerPopover";
