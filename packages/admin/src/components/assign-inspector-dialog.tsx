import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminUserRow, type InspectionRequestRow } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { Button, ErrorState, Input } from "@/components/ui";

/**
 * Putting a BuildPanda inspector on a request. This is the platform's own act:
 * assignment is what schedules the visit and what grants that account — and
 * nobody else — the right to record the findings.
 */
export function AssignInspectorDialog({
  request,
  onClose,
}: {
  request: InspectionRequestRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [scheduledAt, setScheduledAt] = useState(request.scheduledAt.slice(0, 10));

  const { data: users } = useQuery({
    queryKey: adminKeys.users.list({ search, limit: 20 }),
    queryFn: () => adminApi.listUsers({ search, limit: 20 }),
  });

  const assign = useMutation({
    mutationFn: (inspectorUserId: string) =>
      adminApi.assignInspector(request.id, {
        inspectorUserId,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.inspectionRequests.all() });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-ink">Assign a BuildPanda inspector</h2>
        <p className="mt-1 text-sm text-muted">
          "{request.title}" · {request.projectName ?? "Unnamed project"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Inspecting {request.contractorName ?? "an unnamed contractor"} · requested by{" "}
          {request.requestedByName ?? "unknown"} ({request.requestedBySide}-side)
        </p>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
          Visit date
        </label>
        <Input
          type="date"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="mt-1.5"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
          Inspector
        </label>
        <Input
          placeholder="Search BuildPanda staff by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1.5"
        />

        <ul className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-line">
          {(users?.rows ?? []).map((user: AdminUserRow) => (
            <li key={user.id}>
              <button
                type="button"
                disabled={assign.isPending}
                onClick={() => assign.mutate(user.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-ink transition-colors hover:bg-surface-muted disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted">{user.email}</span>
                </span>
                {user.id === request.inspectorUserId ? (
                  <span className="text-xs font-semibold text-brand">Assigned</span>
                ) : null}
              </button>
            </li>
          ))}
          {users?.rows.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted">No users found.</li>
          ) : null}
        </ul>

        {assign.isError ? <div className="mt-3"><ErrorState /></div> : null}

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
AssignInspectorDialog.displayName = "AssignInspectorDialog";
