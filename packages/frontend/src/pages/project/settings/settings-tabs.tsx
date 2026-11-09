import { type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "programme", label: "Programme" },
  { id: "money", label: "Money" },
  { id: "panda-ai", label: "Panda AI" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

const FALLBACK: SettingsTab = "general";

/**
 * The active tab lives in `?tab=`, so a deep link or a reload lands on the same
 * card — the same contract the finance pages use.
 */
export function useSettingsTab(): { tab: SettingsTab; setTab: (next: SettingsTab) => void } {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab = SETTINGS_TABS.some((t) => t.id === raw) ? (raw as SettingsTab) : FALLBACK;

  function setTab(next: SettingsTab): void {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === FALLBACK) params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  }

  return { tab, setTab };
}

/** Label above every settings field: small, semibold, tight to its input. */
export const FIELD_LABEL_CLASS = "text-caption-m! font-semibold text-[#1E1E1E]";

export function SettingsTabBar({ value, onChange }: { value: SettingsTab; onChange: (id: SettingsTab) => void }) {
  return (
    <div role="tablist" aria-label="Project settings sections" className="flex flex-wrap gap-2">
      {SETTINGS_TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "h-9 rounded-full border px-4 text-caption-l! font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
            value === item.id
              ? "border-[#1E1E1E] bg-[#1E1E1E] text-white"
              : "border-[#EBEBEB] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

SettingsTabBar.displayName = "SettingsTabBar";

/** Title + one-line description that opens a card or a section within one. */
export function SettingsHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-h6 font-semibold text-[#1E1E1E]">{title}</h2>
      {description ? <p className="mt-1 text-pretty text-caption-l! text-gray-500">{description}</p> : null}
    </div>
  );
}

SettingsHeading.displayName = "SettingsHeading";

export function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-[#EBEBEB] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <SettingsHeading title={title} description={description} />
        {action}
      </div>
      {children}
    </section>
  );
}

SettingsCard.displayName = "SettingsCard";

/** The save row every editable settings card ends with. */
export function SaveRow({
  dirty,
  disabled = false,
  loading,
  error,
  onSave,
  draftNotice = false,
}: {
  dirty: boolean;
  disabled?: boolean;
  loading: boolean;
  error: unknown;
  onSave: () => void;
  draftNotice?: boolean;
}) {
  return (
    <>
      {error ? (
        <p className="mt-4 rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">
          {errorMessage(error)}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {dirty && draftNotice ? <p role="status" className="mr-auto text-xs text-ink-muted">Your edits are kept in this browser tab. Save to update the project.</p> : null}
        <Button
          type="button"
          variant="primary"
          size="md"
          className="h-[46px]"
          disabled={!dirty || disabled || loading}
          loading={loading}
          onClick={onSave}
        >
          Save Changes
        </Button>
      </div>
    </>
  );
}

SaveRow.displayName = "SaveRow";
