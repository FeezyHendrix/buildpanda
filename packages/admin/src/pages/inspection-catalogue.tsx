import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type InspectionCategoryRow } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { PageContainer } from "@/components/page-container";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  PageHeader,
} from "@/components/ui";
import { CatalogueRow } from "@/components/inspection-catalogue-row";

/**
 * BuildPanda's service catalogue: the inspections the platform offers. Every
 * project on the platform picks from this list, so it is ours to curate — a
 * workspace may add its own categories on top but cannot touch these.
 */
export default function InspectionCataloguePage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: adminKeys.inspectionCategories.list(true),
    queryFn: () => adminApi.listInspectionCategories(true),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: adminKeys.inspectionCategories.all() });

  const create = useMutation({
    mutationFn: (value: string) => adminApi.createInspectionCategory({ name: value }),
    onSuccess: () => {
      setName("");
      void invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; sortOrder?: number; active?: boolean }) =>
      adminApi.updateInspectionCategory(id, body),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteInspectionCategory(id),
    onSuccess: invalidate,
  });

  if (isLoading && !data) return <Loading />;
  if (isError || !data) return <ErrorState />;

  // A copy, not .sort() in place: the array belongs to the React Query cache.
  const rows = [...data].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const live = rows.filter((row) => row.active).length;
  const error = create.error ?? update.error ?? remove.error;

  function move(row: InspectionCategoryRow, direction: -1 | 1) {
    const index = rows.findIndex((r) => r.id === row.id);
    const swap = rows[index + direction];
    if (!swap) return;
    update.mutate({ id: row.id, sortOrder: swap.sortOrder });
    update.mutate({ id: swap.id, sortOrder: row.sortOrder });
  }

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        title="Inspection catalogue"
        description="The inspections BuildPanda offers. Every project sees this list, plus anything its own workspace adds. Categories in use are archived, never deleted."
      />

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">
            {live} of {rows.length} categories live
          </p>
          <p className="mt-1 text-sm text-muted">
            Adding one here makes it selectable on every project on the platform.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Input
            value={name}
            placeholder="e.g. Piling integrity"
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) create.mutate(name.trim());
            }}
            className="sm:w-64"
          />
          <Button
            loading={create.isPending}
            disabled={name.trim().length === 0}
            onClick={() => create.mutate(name.trim())}
          >
            Add
          </Button>
        </div>
      </Card>

      {error ? <ErrorState message={messageOf(error)} /> : null}

      {rows.length === 0 ? (
        <EmptyState
          title="The catalogue is empty"
          hint="Add the first inspection BuildPanda offers."
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {rows.map((row, index) => (
            <CatalogueRow
              key={row.id}
              row={row}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              busy={update.isPending || remove.isPending}
              onMove={move}
              onRename={(value) => update.mutate({ id: row.id, name: value })}
              onToggleActive={() => update.mutate({ id: row.id, active: !row.active })}
              onDelete={() => remove.mutate(row.id)}
            />
          ))}
        </Card>
      )}

      <p className="text-xs text-muted">
        Usage counts span every project on the platform. A category an inspection already holds
        keeps its records: archiving removes it from the picker without rewriting history.
      </p>
      <div className="flex">
        <Badge tone="neutral">Global catalogue · managed by BuildPanda</Badge>
      </div>
    </PageContainer>
  );
}

function messageOf(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string; error?: string } } })
    ?.response?.data;
  return response?.message ?? response?.error ?? "Something went wrong. Please try again.";
}
