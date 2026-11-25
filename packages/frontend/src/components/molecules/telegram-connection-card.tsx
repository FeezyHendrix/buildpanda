import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { INPUT_BASE_CLASS } from "@/components/atoms/input";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useTelegramConnection } from "@/hooks/use-telegram-connection";

export function TelegramConnectionCard({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { selectedBuildingId, setSelectedBuildingId } = useBuildingScope();
  const telegram = useTelegramConnection(projectId, selectedBuildingId);
  if (!telegram.visible) return null;
  return (
    <Card className="my-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Telegram connection">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Panda on Telegram</h2>
          {telegram.connected ? <Badge tone="success">Connected</Badge> : null}
        </div>
        <p className="text-sm text-gray-600">{telegram.connected ? `Send your reports to Panda for ${projectName}.` : `Connect once to send text and voice reports for ${projectName}.`}</p>
        {!telegram.connected ? <p className="text-sm text-gray-600">Tap Connect Telegram, then tap Start in Telegram.</p> : null}
        {!telegram.connected && telegram.buildings.length > 1 ? <label className="block text-sm font-medium">
          Building
          <select aria-label="Telegram building" className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={telegram.buildingId ?? ""} onChange={(event) => setSelectedBuildingId(event.target.value || undefined)} disabled={telegram.connect.isPending}>
            <option value="">Choose a building</option>
            {telegram.buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label> : null}
        {telegram.switching ? <p className="text-sm text-gray-600">Connecting switches this Telegram account to this project and cancels its pending reviews.</p> : null}
        {telegram.connect.error ? <p role="alert" className="text-sm text-red-600">{telegram.connect.error.message}</p> : null}
      </div>
      {!telegram.connected ? <Button size="lg" className="min-h-14 w-full shrink-0 sm:w-auto" loading={telegram.connect.isPending} disabled={!telegram.ready} onClick={() => telegram.connect.mutate()}>Connect Telegram</Button> : null}
    </Card>
  );
}
