import { useMemo, useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import {
  ChevronRightIcon,
  MessagesIcon,
} from "@/components/atoms/project-nav-icons";
import { CommentPanel } from "@/components/molecules/comment-panel";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useAddComment,
  useProjectUpdates,
  useTransitionUpdate,
  useUpdateComments,
} from "@/hooks/use-updates";
import { formatDateTime, formatTimeAgo } from "@/lib/formatters";
import { UPDATE_CATEGORY_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import type {
  Person,
  ProjectUpdate,
  UpdateCategory,
  UpdateStatus,
} from "@/lib/project-mock-data";

const CATEGORY_TARGET_STATUS: Record<UpdateCategory, Exclude<UpdateStatus, "Open">> = {
  Progress: "Approved",
  "Material Delivery": "Inspected",
  Inspections: "Approved",
  Issues: "Resolved",
};

const STATUS_BADGE_TONE: Record<
  Exclude<UpdateStatus, "Open">,
  "success" | "info" | "warning" | "danger"
> = {
  Approved: "success",
  Inspected: "info",
  Resolved: "success",
  Escalated: "warning",
};

type CategoryFilter = "All" | UpdateCategory;

const CATEGORY_FILTERS: CategoryFilter[] = [
  "All",
  "Progress",
  "Material Delivery",
  "Inspections",
  "Issues",
];

interface FilterState {
  category: CategoryFilter;
  contractor: string | null;
  dateFrom: string;
  dateTo: string;
}

const INITIAL_FILTERS: FilterState = {
  category: "All",
  contractor: null,
  dateFrom: "",
  dateTo: "",
};

export default function ProjectUpdates() {
  const { project } = useProjectContext();
  const { data: updates = [] } = useProjectUpdates(project.id);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const contractors = useMemo(() => uniqueContractors(updates), [updates]);
  const visible = useMemo(
    () => filterUpdates(updates, filters),
    [updates, filters],
  );

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Updates"
        description="Track construction progress with real-time reports from the site."
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <section className="flex flex-col gap-4">
          {visible.length === 0 ? (
            <Card padding="lg" className="text-center text-sm text-gray-500">
              No updates match the current filters.
            </Card>
          ) : (
            visible.map((update) => (
              <UpdateCard
                key={update.id}
                projectId={project.id}
                update={update}
              />
            ))
          )}
        </section>

        <FiltersPanel
          filters={filters}
          contractors={contractors}
          onChange={updateFilter}
        />
      </div>
    </div>
  );
}

function uniqueContractors(
  updates: ProjectUpdate[],
): Pick<Person, "id" | "name" | "role">[] {
  const seen = new Map<string, Pick<Person, "id" | "name" | "role">>();
  for (const update of updates) {
    if (!seen.has(update.author.id)) {
      seen.set(update.author.id, {
        id: update.author.id,
        name: update.author.name,
        role: update.author.role,
      });
    }
  }
  return Array.from(seen.values());
}

function filterUpdates(
  updates: ProjectUpdate[],
  filters: FilterState,
): ProjectUpdate[] {
  return updates.filter((u) => {
    if (filters.category !== "All" && u.category !== filters.category)
      return false;
    if (filters.contractor && u.author.id !== filters.contractor) return false;
    const created = new Date(u.createdAt);
    if (filters.dateFrom && created < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && created > new Date(filters.dateTo)) return false;
    return true;
  });
}

function UpdateCard({
  projectId,
  update,
}: {
  projectId: string;
  update: ProjectUpdate;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const transition = useTransitionUpdate();
  const addComment = useAddComment();
  const commentsQuery = useUpdateComments(
    commentsOpen ? projectId : undefined,
    commentsOpen ? update.id : undefined,
  );

  const isOpen = update.status === "Open";
  const targetStatus = CATEGORY_TARGET_STATUS[update.category];

  function handleTransition(): void {
    if (!isOpen || transition.isPending) return;
    transition.mutate({
      projectId,
      updateId: update.id,
      status: targetStatus,
    });
  }

  function handlePostComment(body: string): void {
    addComment.mutate({ projectId, updateId: update.id, body });
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar
            name={update.author.name}
            src={update.author.avatarUrl}
            size="md"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {update.author.name}
            </p>
            <p className="text-xs text-gray-500">
              {update.author.role} · {formatDateTime(update.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {update.status !== "Open" && (
            <Badge tone={STATUS_BADGE_TONE[update.status]} size="md" dot>
              {update.status}
            </Badge>
          )}
          <Badge tone={UPDATE_CATEGORY_TONE[update.category]} size="md">
            {update.category}
          </Badge>
        </div>
      </header>

      <div>
        <h3 className="text-base font-semibold text-gray-900">
          {update.title}
        </h3>
        <p className="mt-1 text-sm text-gray-600 text-pretty">
          {update.description}
        </p>
        {!isOpen && update.action.takenBy && update.action.takenAt && (
          <p className="mt-1.5 text-[11px] text-gray-500">
            {update.status} by {update.action.takenBy.name} ·{" "}
            {formatTimeAgo(update.action.takenAt)}
          </p>
        )}
      </div>

      <MediaGallery items={update.media} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F0F0] pt-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCommentsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            <MessagesIcon className="size-4" />
            {commentsOpen ? "Hide comments" : "Comment"}
          </button>
          {update.secondaryAction && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#004DE7] hover:underline"
            >
              {update.secondaryAction.label}
              <ChevronRightIcon className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant={update.cta.tone === "primary" ? "primary" : "secondary"}
          disabled={!isOpen || transition.isPending}
          onClick={handleTransition}
        >
          {transition.isPending
            ? "Submitting…"
            : !isOpen
              ? update.status
              : update.cta.label}
        </Button>
      </footer>

      {commentsOpen && (
        <CommentPanel
          comments={commentsQuery.data ?? []}
          isLoading={commentsQuery.isLoading}
          isSubmitting={addComment.isPending}
          onSubmit={handlePostComment}
        />
      )}
    </Card>
  );
}

interface FiltersPanelProps {
  filters: FilterState;
  contractors: Pick<Person, "id" | "name" | "role">[];
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
}

function FiltersPanel({ filters, contractors, onChange }: FiltersPanelProps) {
  return (
    <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-24">
      <Card padding="md">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          By Categories
        </h3>
        <div className="flex flex-col gap-1">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange("category", c)}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                filters.category === c
                  ? "bg-[#EDEDED] font-semibold text-gray-900"
                  : "text-gray-600 hover:bg-[#F6F6F6]",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          By Contractors
        </h3>
        <div className="flex flex-col gap-1">
          <RadioRow
            label="Anyone"
            checked={filters.contractor === null}
            onChange={() => onChange("contractor", null)}
          />
          {contractors.map((c) => (
            <RadioRow
              key={c.id}
              label={c.name}
              sublabel={c.role}
              checked={filters.contractor === c.id}
              onChange={() => onChange("contractor", c.id)}
            />
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          By Date Range
        </h3>
        <div className="flex flex-col gap-3">
          <DateField
            label="From"
            value={filters.dateFrom}
            onChange={(v) => onChange("dateFrom", v)}
          />
          <DateField
            label="To"
            value={filters.dateTo}
            onChange={(v) => onChange("dateTo", v)}
          />
        </div>
      </Card>
    </aside>
  );
}

interface RadioRowProps {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}

function RadioRow({ label, sublabel, checked, onChange }: RadioRowProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#F6F6F6]",
        checked && "bg-[#F6F6F6]",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-[#004DE7]" : "border-gray-300",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-[#004DE7]" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-900">
          {label}
        </span>
        {sublabel && (
          <span className="block truncate text-[11px] text-gray-500">
            {sublabel}
          </span>
        )}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900",
          "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
      />
    </label>
  );
}
