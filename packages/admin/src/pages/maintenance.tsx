import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type MaintenanceSettings } from "@/api/admin";
import { Button, Card, Loading, ErrorState, PageHeader, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function MaintenancePage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "maintenance"],
    queryFn: adminApi.getMaintenance,
  });

  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data) setMessage(data.message ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: (body: { enabled?: boolean; message?: string | null }) =>
      adminApi.updateMaintenance(body),
    onSuccess: (next: MaintenanceSettings) => {
      qc.setQueryData(["admin", "maintenance"], next);
    },
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState />;

  const enabled = data.enabled;
  const messageDirty = message.trim() !== (data.message ?? "").trim();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Maintenance mode"
        description="Take the customer app offline for everyone except platform admins. The admin panel always stays accessible."
      />

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-ink">Customer app</span>
              <Badge tone={enabled ? "danger" : "success"}>{enabled ? "Offline" : "Live"}</Badge>
            </div>
            <p className="text-sm text-muted">
              {enabled
                ? "Users see the maintenance page. Platform admins can still sign in and use the app."
                : "The app is available to all users."}
            </p>
          </div>

          <Button
            variant={enabled ? "secondary" : "danger"}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ enabled: !enabled })}
          >
            {mutation.isPending ? "Saving…" : enabled ? "Bring app back online" : "Take app offline"}
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-5">
          <label htmlFor="maintenance-message" className="text-sm font-semibold text-ink">
            Message shown to users
          </label>
          <textarea
            id="maintenance-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="We're making improvements and will be back shortly."
            className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              disabled={!messageDirty || mutation.isPending}
              onClick={() => mutation.mutate({ message: message.trim() || null })}
            >
              Save message
            </Button>
          </div>
        </div>

        {data.updatedByName ? (
          <p className="text-xs text-muted">
            Last changed by {data.updatedByName} on {formatDate(data.updatedAt)}.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
