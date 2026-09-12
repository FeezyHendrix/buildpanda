import { useNavigate } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ProgressBar } from "@/components/atoms/progress-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import type { Building } from "@/api/buildings";

const BUILDING_STATUS_META: Record<Building["status"], { label: string; tone: BadgeTone }> = {
  planned: { label: "Planned", tone: "neutral" },
  active: { label: "Active", tone: "info" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
};

interface BuildingsPanelProps {
  projectId: string;
  buildings: Building[];
}

/** One row per real building on a multi-building project, linking to its stages. */
export function BuildingsPanel({ projectId, buildings }: BuildingsPanelProps) {
  return (
    <Table bleed>
      <TableHead>
        <tr>
          <TableHeaderCell>Building</TableHeaderCell>
          <TableHeaderCell>Code</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Progress</TableHeaderCell>
          <TableHeaderCell align="right">
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {buildings.map((building) => (
          <BuildingRow key={building.id} projectId={projectId} building={building} />
        ))}
      </TableBody>
    </Table>
  );
}

BuildingsPanel.displayName = "BuildingsPanel";

function BuildingRow({ projectId, building }: { projectId: string; building: Building }) {
  const navigate = useNavigate();
  const meta = BUILDING_STATUS_META[building.status];
  return (
    <TableRow>
      <TableCell className="font-medium">{building.name}</TableCell>
      <TableCell className="text-ink-muted">{building.code || "—"}</TableCell>
      <TableCell>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell className="min-w-40">
        <div className="flex items-center gap-3">
          <ProgressBar tone="success" size="md" value={building.progressPercent} className="flex-1" />
          <span className="w-10 text-right text-xs tabular-nums text-ink-muted">
            {building.progressPercent}%
          </span>
        </div>
      </TableCell>
      <TableCell align="right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/project/${projectId}/buildings/${building.id}/stages`)}
        >
          Open
        </Button>
      </TableCell>
    </TableRow>
  );
}

BuildingRow.displayName = "BuildingRow";
