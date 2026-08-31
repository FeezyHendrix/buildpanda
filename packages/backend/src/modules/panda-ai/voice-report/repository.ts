import type { Knex } from "knex";
import type { ProjectSnapshot } from "./types.ts";

interface RfiPick {
  id: string;
  number: number;
  subject: string;
  status: string;
}

interface ChangeRequestPick {
  id: string;
  title: string;
  status: string;
}

interface MaterialOrderPick {
  id: string;
  title: string;
  material_name: string;
  quantity: number;
  unit: string;
  status: string;
}

interface LookAheadPick {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

/**
 * Compact, project-scoped index of records voice actions may target. The
 * classifier can only update or delete a record whose id appears here — that is
 * what stops the model from inventing ids for records that don't exist.
 */
export function voiceReportRepository(db: Knex) {
  return {
    async snapshot(projectId: string): Promise<ProjectSnapshot> {
      const [rfis, changeRequests, materialOrders, lookAheads] = await Promise.all([
        db<RfiPick>("rfis")
          .where({ project_id: projectId })
          .whereNotIn("status", ["Closed", "Void"])
          .orderBy("number", "desc")
          .limit(20)
          .select("id", "number", "subject", "status"),
        db<ChangeRequestPick>("change_requests")
          .where({ project_id: projectId })
          .orderBy("created_at", "desc")
          .limit(15)
          .select("id", "title", "status"),
        db<MaterialOrderPick>("material_orders")
          .where({ project_id: projectId })
          .orderBy("created_at", "desc")
          .limit(15)
          .select("id", "title", "material_name", "quantity", "unit", "status"),
        db<LookAheadPick>("look_aheads")
          .where({ project_id: projectId })
          .orderBy("start_date", "desc")
          .limit(10)
          .select("id", "name", "start_date", "end_date", "status"),
      ]);

      return {
        rfis: rfis.map((r) => ({ id: r.id, number: r.number, subject: r.subject, status: r.status })),
        changeRequests: changeRequests.map((c) => ({ id: c.id, title: c.title, status: c.status })),
        materialOrders: materialOrders.map((m) => ({
          id: m.id,
          title: m.title,
          materialName: m.material_name,
          quantity: Number(m.quantity),
          unit: m.unit,
          status: m.status,
        })),
        lookAheads: lookAheads.map((l) => ({
          id: l.id,
          name: l.name,
          startDate: l.start_date,
          endDate: l.end_date,
          status: l.status,
        })),
      };
    },
  };
}

export type VoiceReportRepository = ReturnType<typeof voiceReportRepository>;
