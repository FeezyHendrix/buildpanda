import { useNavigate } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSectionRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatTimeAgo } from "@/lib/formatters";
import { UPDATE_CATEGORY_LABEL, UPDATE_CATEGORY_TONE } from "@/lib/project-meta";
import type { PhaseStatus, ProjectPhase, ProjectUpdate } from "@/lib/project-types";

const COLUMN_COUNT = 4;

const PHASE_STATUS_META: Record<PhaseStatus, { label: string; tone: BadgeTone }> = {
  Done: { label: "Done", tone: "success" },
  InProgress: { label: "In progress", tone: "info" },
  Pending: { label: "Pending", tone: "neutral" },
};

interface ActivityPanelProps {
  projectId: string;
  updates: ProjectUpdate[];
  phases: ProjectPhase[];
}

/**
 * Ernest's Activity Metrics grid: one bare table, the latest site updates on
 * top and the programme phases under a section-heading row.
 */
export function ActivityPanel({ projectId, updates, phases }: ActivityPanelProps) {
  return (
    <Table bleed>
      <TableHead>
        <tr>
          <TableHeaderCell>Item</TableHeaderCell>
          <TableHeaderCell>Detail</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell align="right">
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>

      <TableBody>
        <TableSectionRow colSpan={COLUMN_COUNT}>Latest site updates</TableSectionRow>
        {updates.length === 0 ? (
          <TableEmptyRow colSpan={COLUMN_COUNT}>
            <EmptyState
              variant="inline"
              title="No updates yet"
              description="Progress updates posted on this project will appear here."
            />
          </TableEmptyRow>
        ) : (
          updates.map((update) => <UpdateRow key={update.id} projectId={projectId} update={update} />)
        )}
      </TableBody>

      <tbody data-tour="construction-timeline">
        <TableSectionRow colSpan={COLUMN_COUNT}>Timeline</TableSectionRow>
        {phases.length === 0 ? (
          <TableEmptyRow colSpan={COLUMN_COUNT}>
            <EmptyState
              variant="inline"
              title="No phases yet"
              description="Phases from the programme will appear here."
            />
          </TableEmptyRow>
        ) : (
          phases.map((phase) => <PhaseRow key={phase.id} phase={phase} />)
        )}
      </tbody>
    </Table>
  );
}

ActivityPanel.displayName = "ActivityPanel";

function UpdateRow({ projectId, update }: { projectId: string; update: ProjectUpdate }) {
  const navigate = useNavigate();
  return (
    <TableRow>
      <TableCell className="max-w-md">
        <p className="truncate font-medium">{update.title}</p>
        {update.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{update.description}</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap text-ink-muted">
        {formatTimeAgo(update.createdAt)} · {update.author.name}
      </TableCell>
      <TableCell>
        <Badge tone={UPDATE_CATEGORY_TONE[update.category]} dot>
          {UPDATE_CATEGORY_LABEL[update.category]}
        </Badge>
      </TableCell>
      <TableCell align="right">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}/updates`)}>
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

UpdateRow.displayName = "UpdateRow";

function PhaseRow({ phase }: { phase: ProjectPhase }) {
  const meta = PHASE_STATUS_META[phase.status];
  return (
    <TableRow>
      <TableCell className="font-medium">{phase.name}</TableCell>
      <TableCell className="whitespace-nowrap text-ink-muted">{phase.dateRange || "—"}</TableCell>
      <TableCell>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell />
    </TableRow>
  );
}

PhaseRow.displayName = "PhaseRow";
