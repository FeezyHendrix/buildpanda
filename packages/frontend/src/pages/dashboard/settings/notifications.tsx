import { useMemo } from "react";
import { PageHeader } from "@/components/molecules/page-header";
import { ToggleRow } from "@/components/atoms/toggle-row";
import {
  useNotificationPreferences,
  useSetNotificationPreference,
} from "@/hooks/use-notification-preferences";
import type { NotificationPreference } from "@/lib/project-types";

function groupPreferences(
  prefs: NotificationPreference[],
): Array<[string, NotificationPreference[]]> {
  const groups = new Map<string, NotificationPreference[]>();
  for (const pref of prefs) {
    const list = groups.get(pref.group) ?? [];
    list.push(pref);
    groups.set(pref.group, list);
  }
  return [...groups.entries()];
}

function statusDescription(pref: NotificationPreference): string {
  return pref.inAppEnabled
    ? "On — appears in your notification bell"
    : "Off — you will not be notified";
}

export default function NotificationSettings() {
  const { data: preferences = [], isLoading } = useNotificationPreferences();
  const setPreference = useSetNotificationPreference();
  const groups = useMemo(() => groupPreferences(preferences), [preferences]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Notifications"
        description="Choose which in-app notifications you want to receive. Changes apply immediately."
      />

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {groups.map(([group, list]) => (
            <section key={group} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-900">{group}</h2>
              <div className="flex flex-col gap-3">
                {list.map((pref) => (
                  <ToggleRow
                    key={pref.type}
                    title={pref.label}
                    description={statusDescription(pref)}
                    checked={pref.inAppEnabled}
                    disabled={setPreference.isPending}
                    onChange={(checked) =>
                      setPreference.mutate({ type: pref.type, inAppEnabled: checked })
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
