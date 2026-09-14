import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import type { SelectedElement } from "./bim-viewer";
import type { BimCoordinationIssue } from "@/lib/project-types";

interface AssigneeOption {
  id: string;
  name: string;
}

interface BimIssueDashboardProps {
  modelName: string;
  selected: SelectedElement | null;
  issues: BimCoordinationIssue[];
  assigneeOptions: AssigneeOption[];
  issueTitle: string;
  onIssueTitleChange: (value: string) => void;
  issueAssignee: string;
  onIssueAssigneeChange: (value: string) => void;
  onCreateIssue: () => void;
  creating: boolean;
}

function elementLabel(selected: SelectedElement | null): string {
  if (!selected) return "No element selected";
  return selected.name ?? selected.ifcType?.replace(/^Ifc/, "") ?? "Element";
}

export function BimIssueDashboard({
  modelName,
  selected,
  issues,
  assigneeOptions,
  issueTitle,
  onIssueTitleChange,
  issueAssignee,
  onIssueAssigneeChange,
  onCreateIssue,
  creating,
}: BimIssueDashboardProps) {
  const elementIssues = useMemo(
    () =>
      selected?.guid
        ? issues.filter((i) => i.elementGuid === selected.guid)
        : [],
    [issues, selected?.guid],
  );

  const headlineIssue = elementIssues[0] ?? null;
  const openCount = elementIssues.filter((i) => i.status === "Open").length;

  return (
    <aside className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line-hair bg-surface-alt p-4">
      {!selected?.guid ? (
        <EmptyHint />
      ) : (
        <>
          <HeadlineCard
            element={elementLabel(selected)}
            ifcType={selected.ifcType}
            headlineIssue={headlineIssue}
            openCount={openCount}
          />

          <LocationCard selected={selected} modelName={modelName} />

          <DueDateCard issue={headlineIssue} />

          {elementIssues.length > 0 ? (
            <IssueListCard issues={elementIssues} />
          ) : null}

          <CreateIssueCard
            element={elementLabel(selected)}
            ifcType={selected.ifcType}
            assigneeOptions={assigneeOptions}
            issueTitle={issueTitle}
            onIssueTitleChange={onIssueTitleChange}
            issueAssignee={issueAssignee}
            onIssueAssigneeChange={onIssueAssigneeChange}
            onCreateIssue={onCreateIssue}
            creating={creating}
          />
        </>
      )}
    </aside>
  );
}

BimIssueDashboard.displayName = "BimIssueDashboard";

function EmptyHint() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6"
          aria-hidden="true"
        >
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink">Select a component</p>
      <p className="text-xs text-ink-muted text-pretty">
        Click any element in the model to open its coordination panel — status,
        location and due date.
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line-hair bg-white p-4",
        className,
      )}
    >
      {title ? (
        <p className="mb-3 text-xs font-medium uppercase text-ink-muted">
          {title}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function HeadlineCard({
  element,
  ifcType,
  headlineIssue,
  openCount,
}: {
  element: string;
  ifcType: string | null;
  headlineIssue: BimCoordinationIssue | null;
  openCount: number;
}) {
  return (
    <Panel>
      {ifcType ? (
        <span className="inline-block rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium uppercase text-primary-700">
          {ifcType.replace(/^Ifc/, "")}
        </span>
      ) : null}
      <h2 className="mt-2 text-lg font-medium leading-tight text-ink text-balance">
        {headlineIssue ? headlineIssue.title : element}
      </h2>
      {headlineIssue ? (
        <p className="mt-1 text-xs text-ink-muted">on {element}</p>
      ) : (
        <p className="mt-1 text-xs text-ink-muted">
          No coordination issue on this component yet.
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {headlineIssue ? (
          <Badge
            tone={headlineIssue.status === "Open" ? "danger" : "success"}
            size="sm"
          >
            {headlineIssue.status}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            Clear
          </Badge>
        )}
        {openCount > 1 ? (
          <span className="text-xs text-ink-muted">
            +{openCount - 1} more open
          </span>
        ) : null}
      </div>
    </Panel>
  );
}

function LocationCard({
  selected,
  modelName,
}: {
  selected: SelectedElement;
  modelName: string;
}) {
  const guidShort = selected.guid ? `${selected.guid.slice(0, 12)}…` : "—";
  return (
    <Panel title="Location">
      <dl className="flex flex-col gap-2 text-sm">
        <Row label="Model" value={modelName} />
        <Row label="Element" value={elementLabel(selected)} />
        {selected.ifcType ? (
          <Row label="Type" value={selected.ifcType.replace(/^Ifc/, "")} />
        ) : null}
        <Row label="GUID" value={guidShort} mono />
      </dl>
    </Panel>
  );
}

function DueDateCard({ issue }: { issue: BimCoordinationIssue | null }) {
  return (
    <Panel title="Due date">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">
          {issue ? "Tracked once scheduled" : "No issue to schedule"}
        </span>
        <span className="text-sm font-semibold text-ink-muted">Not set</span>
      </div>
      <p className="mt-2 text-xs text-ink-muted text-pretty">
        Due dates for BIM issues arrive with the scheduling update.
      </p>
    </Panel>
  );
}

function IssueListCard({ issues }: { issues: BimCoordinationIssue[] }) {
  return (
    <Panel title={`Issues on this element (${issues.length})`}>
      <ul className="flex flex-col gap-2">
        {issues.slice(0, 6).map((issue) => (
          <li
            key={issue.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-surface-alt px-3 py-2"
          >
            <span className="truncate text-sm text-ink">
              {issue.title}
            </span>
            <Badge
              tone={issue.status === "Open" ? "danger" : "success"}
              size="sm"
            >
              {issue.status}
            </Badge>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CreateIssueCard({
  element,
  ifcType,
  assigneeOptions,
  issueTitle,
  onIssueTitleChange,
  issueAssignee,
  onIssueAssigneeChange,
  onCreateIssue,
  creating,
}: {
  element: string;
  ifcType: string | null;
  assigneeOptions: AssigneeOption[];
  issueTitle: string;
  onIssueTitleChange: (value: string) => void;
  issueAssignee: string;
  onIssueAssigneeChange: (value: string) => void;
  onCreateIssue: () => void;
  creating: boolean;
}) {
  const inputClass = INPUT_SM_CLASS;
  return (
    <Panel title="Flag this component">
      <input
        value={issueTitle}
        onChange={(e) => onIssueTitleChange(e.target.value)}
        placeholder={`e.g. Improper installation on ${ifcType?.replace(/^Ifc/, "") ?? element}`}
        className={cn(inputClass, "mb-2")}
      />
      <select
        value={issueAssignee}
        onChange={(e) => onIssueAssigneeChange(e.target.value)}
        className={cn(inputClass, "mb-3")}
      >
        <option value="">Assign a person…</option>
        {assigneeOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Button
        variant="primary"
        size="md"
        className="w-full"
        loading={creating}
        disabled={issueTitle.trim() === ""}
        onClick={onCreateIssue}
      >
        Create issue
      </Button>
    </Panel>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "truncate text-right font-medium text-ink",
          mono && "font-mono text-xs text-ink-muted",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
