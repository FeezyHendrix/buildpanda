import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type FeatureFlag, type FeatureFlagsSettings } from "@/api/admin";
import { Badge, Button, Card, ErrorState, Loading, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

function groupFlags(flags: FeatureFlag[]): Array<{ group: string; flags: FeatureFlag[] }> {
  const byGroup = new Map<string, FeatureFlag[]>();
  for (const flag of flags) {
    const list = byGroup.get(flag.group) ?? [];
    list.push(flag);
    byGroup.set(flag.group, list);
  }
  return [...byGroup.entries()].map(([group, rows]) => ({ group, flags: rows }));
}

export default function FeatureFlagsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "feature-flags"],
    queryFn: adminApi.getFeatureFlags,
  });
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  const flags = data?.flags ?? [];
  const values = useMemo(() => {
    const base: Record<string, boolean> = {};
    for (const flag of flags) base[flag.key] = draft[flag.key] ?? flag.enabled;
    return base;
  }, [draft, flags]);

  const mutation = useMutation({
    mutationFn: (next: Record<string, boolean>) => adminApi.updateFeatureFlags(next),
    onSuccess: (next: FeatureFlagsSettings) => {
      setDraft({});
      qc.setQueryData(["admin", "feature-flags"], next);
    },
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState />;

  const dirty = flags.some((flag) => values[flag.key] !== flag.enabled);
  const enabledCount = flags.filter((flag) => values[flag.key]).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Feature flags"
        description="Turn product areas on or off platform-wide. Disabled features are hidden from users by API enforcement, while admin stays accessible."
      />

      <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{enabledCount} of {flags.length} features enabled</p>
          <p className="mt-1 text-sm text-muted">
            Last updated {data.updatedAt ? formatDate(data.updatedAt) : "never"}
            {data.updatedByName ? ` by ${data.updatedByName}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!dirty || mutation.isPending} onClick={() => setDraft({})}>
            Reset
          </Button>
          <Button disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate(values)}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-5">
        {groupFlags(flags).map(({ group, flags: groupRows }) => (
          <Card key={group} className="overflow-hidden">
            <div className="border-b border-line bg-surface-muted px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{group}</h2>
            </div>
            <div className="divide-y divide-line">
              {groupRows.map((flag) => {
                const enabled = values[flag.key] ?? flag.enabled;
                return (
                  <div key={flag.key} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{flag.label}</p>
                        <Badge tone={enabled ? "success" : "danger"}>{enabled ? "Enabled" : "Off"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">{flag.description}</p>
                      <p className="mt-2 text-xs text-muted/80">{flag.routePrefixes.join(", ")}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => setDraft((prev) => ({ ...prev, [flag.key]: !enabled }))}
                      className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? "bg-brand" : "bg-[#d1d5db]"}`}
                    >
                      <span className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
