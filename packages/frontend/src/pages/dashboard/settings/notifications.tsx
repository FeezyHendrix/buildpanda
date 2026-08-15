import { useMemo, useState } from "react";
import { ToggleSwitch } from "@/components/atoms/toggle-switch";
import {
  useNotificationPreferences,
  useSetNotificationPreference,
} from "@/hooks/use-notification-preferences";
import type { NotificationPreference } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components";

function groupPreferences(
  prefs: NotificationPreference[],
): Array<[string, NotificationPreference[]]> {
  const groups = new Map<string, NotificationPreference[]>();
  for (const pref of prefs) {
    const list = groups.get(pref.group) ?? [];
    list.push(pref);
    groups.set(pref.group, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function statusDescription(pref: NotificationPreference): string {
  return pref.inAppEnabled
    ? "On, appears in your notification bell"
    : "Off, you will not be notified";
}

export default function NotificationSettings() {
  const { data: preferences = [], isLoading } = useNotificationPreferences();
  const setPreference = useSetNotificationPreference();
  const groups = useMemo(() => groupPreferences(preferences), [preferences]);
  
  const [expandedGroup, setExpandedGroup] = useState<string>("Project");

  return (
    <div className="flex w-full flex-col">
      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-4 w-full flex flex-col gap-2.5 pb-20">
          {groups.map(([group, list]) => {
            const isExpanded = expandedGroup === group;
            
            return (
              <div 
                key={group}
                className="overflow-hidden w-full"
              >
                <Button
                  type="button"
                  size='lg'
                  variant='outline'
                  onClick={() => setExpandedGroup(isExpanded ? "" : group)}
                  className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors bg-[#F5F5F5] !rounded-none"
                >
                  <span className="text-body-s font-semibold text-gray-800">{group}</span>
                  <ChevronDown  
                    className={cn(
                      "size-5 text-[#262626] transition-transform duration-200",
                      isExpanded ? "rotate-180" : ""
                    )} 
                  />
                </Button>
                
                {isExpanded && (
                  <div className="flex flex-col border-[0.5px] border-border bg-white">
                    {list.map((pref, idx) => (
                      <div
                        key={pref.type}
                        className={cn(
                          "flex items-center justify-between gap-4 p-5",
                          idx < list.length - 1 ? "border-b border-[#F0F0F0]" : ""
                        )}
                      >
                        <div className="flex-1">
                          <p className="text-body-s font-semibold text-black-500">
                            {pref.label}
                          </p>
                          <p className="mt-1 text-caption-l font-light text-grey-450">
                            {statusDescription(pref)}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={pref.inAppEnabled}
                          disabled={setPreference.isPending}
                          onChange={(checked) =>
                            setPreference.mutate({ type: pref.type, inAppEnabled: checked })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
