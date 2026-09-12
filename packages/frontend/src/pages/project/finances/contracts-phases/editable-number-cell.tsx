import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import { parseEstimate } from "./contract-model";

/**
 * Click-to-edit number in a table cell: click shows an input, Enter commits,
 * Escape reverts, blur commits. Used for the estimates a PM types on the
 * Phases tab; the used/actual columns stay read-only.
 */

interface EditableNumberCellProps {
  value: number | null | undefined;
  /** Display for the read state (e.g. a formatted currency). */
  display: string;
  editable: boolean;
  onCommit: (value: number | null) => void;
  ariaLabel: string;
  saving?: boolean;
}

export function EditableNumberCell({ value, display, editable, onCommit, ariaLabel, saving = false }: EditableNumberCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editable) {
    return <span className="tabular-nums">{display}</span>;
  }

  function open(): void {
    setDraft(value == null ? "" : String(value));
    setInvalid(false);
    setEditing(true);
  }

  function commit(): void {
    const parsed = parseEstimate(draft);
    if (parsed === "invalid") {
      setInvalid(true);
      return;
    }
    setEditing(false);
    if (parsed !== (value ?? null)) onCommit(parsed);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
        title="Click to edit"
        aria-label={`${ariaLabel}: ${display}. Click to edit`}
        className={cn(
          "-mx-2 rounded-md px-2 py-1 text-left tabular-nums hover:bg-primary-50 focus-visible:outline-none focus-visible:shadow-focus",
          saving && "opacity-60",
        )}
      >
        {display}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        setInvalid(false);
      }}
      onKeyDown={handleKey}
      onBlur={commit}
      onClick={(event) => event.stopPropagation()}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={cn(INPUT_SM_CLASS, "min-w-[96px] px-2 text-right tabular-nums")}
    />
  );
}

EditableNumberCell.displayName = "EditableNumberCell";
