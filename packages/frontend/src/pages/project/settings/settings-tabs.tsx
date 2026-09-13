import { type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Tabs } from "@/components/molecules/tabs";
import { errorMessage } from "@/lib/api-error";

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

export function SettingsTabBar({ value, onChange }: { value: SettingsTab; onChange: (id: SettingsTab) => void }) {
  return (
    <Tabs
      items={SETTINGS_TABS}
      value={value}
      onChange={onChange}
      ariaLabel="Project settings sections"
      className="mt-6"
    />
  );
}

SettingsTabBar.displayName = "SettingsTabBar";

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
    <section className="rounded-lg border border-line-hair bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-pretty text-sm text-gray-500">{description}</p>
          ) : null}
        </div>
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
}: {
  dirty: boolean;
  disabled?: boolean;
  loading: boolean;
  error: unknown;
  onSave: () => void;
}) {
  return (
    <>
      {error ? (
        <p className="mt-4 rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">
          {errorMessage(error)}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={!dirty || disabled}
          loading={loading}
          onClick={onSave}
        >
          Save changes
        </Button>
      </div>
    </>
  );
}

SaveRow.displayName = "SaveRow";
