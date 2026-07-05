import { useMemo } from "react";
import { PageHeader } from "@/components/molecules/page-header";
import { ToggleRow } from "@/components/atoms/toggle-row";
import { Switcher } from "@/components/atoms/switcher";
import { Spinner } from "@/components/atoms/spinner";
import {
  useNotificationPreferences,
  useSetNotificationPreference,
} from "@/hooks/use-notification-preferences";
import { usePushNotifications } from "@/hooks/use-push-notifications";
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
    ? "On, appears in your notification bell"
    : "Off, you will not be notified";
}

function pushStatusText(push: ReturnType<typeof usePushNotifications>): string {
  if (push.permissionDenied && !push.enabled) {
    return "Notifications are blocked for this site in your browser settings.";
  }
  return push.enabled
    ? "On, this device will receive notifications even when the app is closed"
    : "Off, this device will not receive push notifications";
}

// Hidden entirely when the browser lacks push support or the server has no
// VAPID keys configured (public key comes back empty).
function PushNotificationsSection() {
  const push = usePushNotifications();

  if (!push.supported || push.isLoading || !push.configured) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-900">This device</h2>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-medium text-gray-900">
            Push notifications on this device
          </p>
          <p className="text-xs text-gray-500">{pushStatusText(push)}</p>
          {push.error !== null ? (
            <p className="text-xs text-red-600">{push.error}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {push.isPending ? <Spinner size="xs" /> : null}
          <Switcher
            value={push.enabled ? "yes" : "no"}
            onChange={(value) => {
              if (push.isPending) return;
              if (value === "yes") push.enable();
              else push.disable();
            }}
          />
        </div>
      </div>
    </section>
  );
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
          <PushNotificationsSection />
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
