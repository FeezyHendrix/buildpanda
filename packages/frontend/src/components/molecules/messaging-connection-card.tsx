import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { INPUT_BASE_CLASS } from "@/components/atoms/input";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useMessagingConnection } from "@/hooks/use-messaging-connection";
import type { MessagingChannelOption } from "@/lib/messaging-connection";

interface MessagingConnectionCardProps {
  projectId: string;
  projectName: string;
  channel: MessagingChannelOption;
}

export function MessagingConnectionCard({ projectId, projectName, channel }: MessagingConnectionCardProps) {
  const { selectedBuildingId, setSelectedBuildingId } = useBuildingScope();
  const connection = useMessagingConnection(projectId, selectedBuildingId, channel);
  if (!connection.visible) return null;
  const { label } = channel;
  return (
    <Card className="my-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-label={`${label} connection`}>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Panda on {label}</h2>
          {connection.connected ? <Badge tone="success">Connected</Badge> : null}
        </div>
        <p className="text-sm text-gray-600">{connection.connected ? `Send your reports to Panda for ${projectName}.` : `Connect once to send text and voice reports for ${projectName}.`}</p>
        {!connection.connected ? <p className="text-sm text-gray-600">Tap Connect {label}, then {channel.startStep}.</p> : null}
        {!connection.connected && connection.buildings.length > 1 ? <label className="block text-sm font-medium">
          Building
          <select aria-label={`${label} building`} className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={connection.buildingId ?? ""} onChange={(event) => setSelectedBuildingId(event.target.value || undefined)} disabled={connection.connect.isPending}>
            <option value="">Choose a building</option>
            {connection.buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label> : null}
        {connection.switching ? <p className="text-sm text-gray-600">Connecting switches this {label} account to this project and cancels its pending reviews.</p> : null}
        {connection.connect.error ? <p role="alert" className="text-sm text-red-600">{connection.connect.error.message}</p> : null}
      </div>
      {!connection.connected ? <Button size="lg" className="min-h-14 w-full shrink-0 sm:w-auto" loading={connection.connect.isPending} disabled={!connection.ready} onClick={() => connection.connect.mutate()}>Connect {label}</Button> : null}
    </Card>
  );
}
MessagingConnectionCard.displayName = "MessagingConnectionCard";
