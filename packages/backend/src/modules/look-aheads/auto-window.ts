import type { Knex } from "knex";
import { activitiesRepository } from "../activities/repository.ts";
import type { ActivityStatus } from "../activities/types.ts";
import { materialsEquipmentRepository } from "../materials-equipment/repository.ts";
import { materialsEquipmentService } from "../materials-equipment/service.ts";
import type { MaterialOrder } from "../materials-equipment/types.ts";

export interface AutoWindowMaterialOrder {
  id: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  status: MaterialOrder["status"];
  neededBy: string;
}

export interface AutoWindowActivity {
  activityId: string;
  activityName: string;
  phaseName: string | null;
  status: ActivityStatus;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned: number;
  fromProgramme: boolean;
  materialOrders: AutoWindowMaterialOrder[];
  hasMaterialCoverage: boolean;
}

export interface AutoWindowResult {
  weeks: number;
  from: string;
  to: string;
  activities: AutoWindowActivity[];
}

function toDateOnly(value: Date | string): string {
  const iso = typeof value === "string" ? value : value.toISOString();
  return iso.slice(0, 10);
}

function toOrder(row: MaterialOrder): AutoWindowMaterialOrder {
  return {
    id: row.id,
    materialName: row.materialName,
    quantity: row.quantity,
    unit: row.unit,
    supplier: row.supplier,
    status: row.status,
    neededBy: row.neededBy,
  };
}

/**
 * Zero-setup preview: activities already on the project chart / imported
 * programme whose planned start falls in the next `weeks` weeks, cross
 * referenced with any material orders linked to them. Complements the
 * user-curated look-aheads below rather than replacing them.
 */
export function autoWindowService(db: Knex) {
  const activities = activitiesRepository(db);
  const orders = materialsEquipmentService(materialsEquipmentRepository(db));

  return {
    async build(projectId: string, weeks: number): Promise<AutoWindowResult> {
      const from = toDateOnly(new Date());
      const to = toDateOnly(new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000));

      const [activityRows, materialOrders, phaseRows] = await Promise.all([
        activities.listByProject(projectId),
        orders.listMaterialOrders(projectId),
        activities.phaseNamesForProject(projectId),
      ]);
      const phaseById = new Map(phaseRows.map((p) => [p.id, p.name]));

      const ordersByActivity = new Map<string, MaterialOrder[]>();
      for (const order of materialOrders) {
        if (!order.activityId) continue;
        const list = ordersByActivity.get(order.activityId) ?? [];
        list.push(order);
        ordersByActivity.set(order.activityId, list);
      }

      const windowed = activityRows
        .filter((row) => row.status !== "Cancelled")
        .map((row) => ({ row, startDate: toDateOnly(row.planned_start_at) }))
        .filter(({ startDate }) => startDate >= from && startDate <= to)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      const result: AutoWindowActivity[] = windowed.map(({ row }) => {
        const linkedOrders = (ordersByActivity.get(row.id) ?? []).map(toOrder);
        return {
          activityId: row.id,
          activityName: row.name,
          phaseName: row.phase_id ? (phaseById.get(row.phase_id) ?? null) : null,
          status: row.status,
          plannedStartAt: toDateOnly(row.planned_start_at),
          plannedEndAt: toDateOnly(row.planned_end_at),
          workerCountPlanned: row.worker_count_planned,
          fromProgramme: row.source === "programme-import",
          materialOrders: linkedOrders,
          hasMaterialCoverage: linkedOrders.some((o) => o.status !== "Cancelled"),
        };
      });

      return { weeks, from, to, activities: result };
    },
  };
}

export type AutoWindowService = ReturnType<typeof autoWindowService>;
