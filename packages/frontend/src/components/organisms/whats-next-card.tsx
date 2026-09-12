import { useNavigate } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
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
import { useReportingSnapshot, type ProjectReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import type { AiSuggestion } from "@/hooks/use-panda-ai";

const COLUMN_COUNT = 4;
const SUGGESTION_LIMIT = 3;

const PRIORITY_RANK: Record<AiSuggestion["priority"], number> = { high: 3, medium: 2, low: 1 };

const PRIORITY_META: Record<AiSuggestion["priority"], { label: string; tone: BadgeTone }> = {
  high: { label: "High", tone: "danger" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "info" },
};

/** Where a suggestion's category sends the reader (categories arrive in mixed case). */
const CATEGORY_PATH: Record<string, string> = {
  budget: "budget",
  finance: "finances",
  schedule: "whats-next",
};

interface AttentionRow {
  key: keyof ProjectReportingSnapshot["operations"];
  singular: string;
  plural: string;
  path: string;
}

const ATTENTION_ROWS: readonly AttentionRow[] = [
  { key: "dueActionItems", singular: "action item due", plural: "action items due", path: "action-items" },
  { key: "blockedActionItems", singular: "action item blocked", plural: "action items blocked", path: "action-items" },
  { key: "openQueries", singular: "open query", plural: "open queries", path: "queries" },
  { key: "pendingApprovals", singular: "pending approval", plural: "pending approvals", path: "approvals" },
  { key: "expiringPermits", singular: "permit expiring", plural: "permits expiring", path: "permits" },
  { key: "upcomingKeyDates", singular: "key date coming up", plural: "key dates coming up", path: "key-dates" },
] as const;

function suggestionPath(projectId: string, category: string): string {
  return `/project/${projectId}/${CATEGORY_PATH[category.toLowerCase()] ?? "panda-ai"}`;
}

function formatSuggestionTitle(title: string): string {
  return title.replace("1 inspection need action", "1 inspection needs action");
}

function attentionLabel(row: AttentionRow, count: number): string {
  return `${count} ${count === 1 ? row.singular : row.plural}`;
}

interface WhatsNextCardProps {
  projectId: string;
}

/**
 * Panda AI's recommended actions and the operational counts that need
 * attention, as one table with a ghost action per row.
 */
export function WhatsNextCard({ projectId }: WhatsNextCardProps) {
  const { data, isPending, isError } = useReportingSnapshot(projectId);

  if (isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <EmptyState
          variant="inline"
          title="Reporting temporarily unavailable"
          description="Panda AI could not load this project's snapshot. Try again shortly."
        />
      </Card>
    );
  }

  const { health, operations } = data;
  const suggestions = [...health.suggestions]
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
    .slice(0, SUGGESTION_LIMIT);
  const attention = ATTENTION_ROWS.filter((row) => operations[row.key] > 0);

  return (
    <Table bleed>
      <TableHead>
        <tr>
          <TableHeaderCell>Action</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell>Priority</TableHeaderCell>
          <TableHeaderCell align="right">
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>

      <TableBody>
        <TableSectionRow colSpan={COLUMN_COUNT}>Panda AI suggestions</TableSectionRow>
        {suggestions.length === 0 ? (
          <TableEmptyRow colSpan={COLUMN_COUNT}>
            <EmptyState
              variant="inline"
              title={health.score === null ? "Panda AI will analyse this project shortly" : "No urgent priorities right now"}
              description="Recommended actions appear here once Panda AI has reviewed the project."
            />
          </TableEmptyRow>
        ) : (
          suggestions.map((suggestion) => (
            <SuggestionRow key={suggestion.title} projectId={projectId} suggestion={suggestion} />
          ))
        )}
      </TableBody>

      <tbody>
        <TableSectionRow colSpan={COLUMN_COUNT}>Needs attention</TableSectionRow>
        {attention.length === 0 ? (
          <TableEmptyRow colSpan={COLUMN_COUNT}>
            <EmptyState variant="inline" title="Nothing needs attention" description="No overdue items, open queries or expiring permits." />
          </TableEmptyRow>
        ) : (
          attention.map((row) => (
            <AttentionTableRow key={row.key} projectId={projectId} row={row} count={operations[row.key]} />
          ))
        )}
      </tbody>
    </Table>
  );
}

WhatsNextCard.displayName = "WhatsNextCard";

function SuggestionRow({ projectId, suggestion }: { projectId: string; suggestion: AiSuggestion }) {
  const navigate = useNavigate();
  const meta = PRIORITY_META[suggestion.priority];
  return (
    <TableRow>
      <TableCell className="max-w-xl">
        <p className="font-medium">{formatSuggestionTitle(suggestion.title)}</p>
        {suggestion.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{suggestion.detail}</p> : null}
      </TableCell>
      <TableCell className="capitalize text-ink-muted">{suggestion.category}</TableCell>
      <TableCell>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell align="right">
        <Button variant="ghost" size="sm" onClick={() => navigate(suggestionPath(projectId, suggestion.category))}>
          Open
        </Button>
      </TableCell>
    </TableRow>
  );
}

SuggestionRow.displayName = "SuggestionRow";

function AttentionTableRow({ projectId, row, count }: { projectId: string; row: AttentionRow; count: number }) {
  const navigate = useNavigate();
  return (
    <TableRow>
      <TableCell className="font-medium">{attentionLabel(row, count)}</TableCell>
      <TableCell className="text-ink-muted">Operations</TableCell>
      <TableCell />
      <TableCell align="right">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}/${row.path}`)}>
          Open
        </Button>
      </TableCell>
    </TableRow>
  );
}

AttentionTableRow.displayName = "AttentionTableRow";
