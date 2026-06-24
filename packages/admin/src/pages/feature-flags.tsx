import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type FeatureFlag, type FeatureFlagsSettings } from "@/api/admin";
import { Button, Card, ErrorState, Loading, PageHeader, Switch } from "@/components/ui";
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

function FlagRow({
  flag,
  enabled,
  onChange,
}: {
  flag: FeatureFlag;
  enabled: boolean;
  onChange: (key: string, value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{flag.label}</p>
        <p className="mt-0.5 text-sm text-muted">{flag.description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(val) => onChange(flag.key, val)}
        className="mt-0.5"
      />
    </div>
  );
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

  function handleChange(key: string, value: boolean) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Feature flags"
        description="Turn product areas on or off platform-wide. Disabled features are blocked at the API level — admin access stays unaffected."
      />

      <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            {enabledCount} of {flags.length} features enabled
          </p>
          <p className="mt-1 text-sm text-muted">
            Last updated {data.updatedAt ? formatDate(data.updatedAt) : "never"}
            {data.updatedByName ? ` by ${data.updatedByName}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => setDraft({})}
          >
            Reset
          </Button>
          <Button
            size="sm"
            disabled={!dirty}
            loading={mutation.isPending}
            onClick={() => mutation.mutate(values)}
          >
            Save changes
          </Button>
        </div>
      </Card>

      <div className="grid gap-5">
        {groupFlags(flags).map(({ group, flags: groupRows }) => (
          <Card key={group} className="overflow-hidden">
            <div className="border-b border-line bg-surface-muted px-5 py-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{group}</h2>
            </div>
            <div className="divide-y divide-line">
              {groupRows.map((flag) => (
                <FlagRow
                  key={flag.key}
                  flag={flag}
                  enabled={values[flag.key] ?? flag.enabled}
                  onChange={handleChange}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
