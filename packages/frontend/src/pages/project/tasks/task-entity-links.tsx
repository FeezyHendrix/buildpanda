import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { useActionItems } from "@/hooks/use-action-items";
import { useProjectRfis } from "@/hooks/use-rfis";
import { useChangeRequests } from "@/hooks/use-change-requests";
import { useMaterialOrders } from "@/hooks/use-materials-equipment";
import { useProjectInvoices } from "@/hooks/use-invoices";
import { useProjectFinances } from "@/hooks/use-finances";
import { useAddEntityLink, useDeleteEntityLink } from "@/hooks/use-tasks";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { TaskEntityLink, TaskEntityType } from "@/lib/project-types";
import { ENTITY_META, ENTITY_ORDER, FIELD } from "./task-ui";

export function TaskEntityLinks({
  projectId,
  taskId,
  entityLinks,
}: {
  projectId: string;
  taskId: string;
  entityLinks: TaskEntityLink[];
}) {
  const navigate = useNavigate();
  const addEntityLink = useAddEntityLink(projectId, taskId);
  const deleteEntityLink = useDeleteEntityLink(projectId, taskId);

  const [entityType, setEntityType] = useState<TaskEntityType>("action_item");
  const [entityTarget, setEntityTarget] = useState<string | null>(null);

  const actionItems = useActionItems(projectId);
  const rfis = useProjectRfis(projectId);
  const changeRequests = useChangeRequests(projectId);
  const materialOrders = useMaterialOrders(projectId);
  const invoices = useProjectInvoices(projectId);
  const finances = useProjectFinances(projectId);

  const candidatesByType = useMemo<Record<TaskEntityType, ComboItem[]>>(
    () => ({
      action_item: (actionItems.data ?? []).map((i) => ({ id: i.id, label: i.title })),
      rfi: (rfis.data ?? []).map((i) => ({ id: i.id, label: i.subject })),
      change_request: (changeRequests.data ?? []).map((i) => ({ id: i.id, label: i.title })),
      material: (materialOrders.data ?? []).map((i) => ({ id: i.id, label: i.materialName })),
      invoice: (invoices.data ?? []).map((i) => ({
        id: i.id,
        label: i.number ? `${i.vendorName} · ${i.number}` : i.vendorName,
      })),
      milestone_payment: (finances.data?.milestones ?? []).map((i) => ({ id: i.id, label: i.name })),
    }),
    [actionItems.data, rfis.data, changeRequests.data, materialOrders.data, invoices.data, finances.data],
  );

  const linkedIds = useMemo(() => new Set(entityLinks.map((l) => `${l.entityType}:${l.entityId}`)), [entityLinks]);
  const pickerItems = useMemo(
    () => candidatesByType[entityType].filter((c) => !linkedIds.has(`${entityType}:${c.id}`)),
    [candidatesByType, entityType, linkedIds],
  );

  const grouped = useMemo(() => {
    const groups = new Map<TaskEntityType, TaskEntityLink[]>();
    for (const link of entityLinks) {
      const list = groups.get(link.entityType) ?? [];
      list.push(link);
      groups.set(link.entityType, list);
    }
    return ENTITY_ORDER.filter((t) => groups.has(t)).map((t) => ({ type: t, links: groups.get(t)! }));
  }, [entityLinks]);

  function submitEntityLink(): void {
    if (!entityTarget) return;
    addEntityLink.mutate(
      { entityType, entityId: entityTarget },
      {
        onSuccess: () => setEntityTarget(null),
        onError: (err) => {
          const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast(message ?? "Could not link item");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Linked items{entityLinks.length > 0 ? ` (${entityLinks.length})` : ""}</Label>

      {grouped.length === 0 ? (
        <p className="text-xs text-gray-400">No linked items yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map((group) => (
            <div key={group.type} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#F0F0F0] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                  {ENTITY_META[group.type].label}
                </span>
                <span className="text-[11px] text-gray-400">{group.links.length}</span>
              </div>
              {group.links.map((link) => (
                <div key={link.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => navigate(`/project/${projectId}/${ENTITY_META[link.entityType].route}`)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-gray-700 hover:text-[#004DE7]"
                    title={`Open ${ENTITY_META[link.entityType].label.toLowerCase()}`}
                  >
                    <span className="truncate">{link.label}</span>
                    {link.status && (
                      <span className="shrink-0 rounded-full bg-[#F6F6F6] px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {link.status}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntityLink.mutate(link.id)}
                    aria-label="Remove linked item"
                    className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-[#FAFAFA] p-2">
        <div className="flex gap-2">
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value as TaskEntityType);
              setEntityTarget(null);
            }}
            className={cn(FIELD, "h-9 w-36 shrink-0")}
          >
            {ENTITY_ORDER.map((t) => (
              <option key={t} value={t}>{ENTITY_META[t].label}</option>
            ))}
          </select>
          <div className="min-w-0 flex-1">
            <ComboSelect
              items={pickerItems}
              value={entityTarget}
              onChange={setEntityTarget}
              placeholder={`Search ${ENTITY_META[entityType].label.toLowerCase()}…`}
              searchPlaceholder="Search…"
              emptyText="Nothing to link"
              className="h-9"
            />
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={submitEntityLink} disabled={!entityTarget} className="self-end">
          Add link
        </Button>
      </div>
    </div>
  );
}

TaskEntityLinks.displayName = "TaskEntityLinks";
