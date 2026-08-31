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

interface ActivityPick {
  id: string;
  name: string;
  status: string;
}

interface DelayReasonPick {
  code: string;
  name: string;
}

interface LedgerEntryPick {
  id: string;
  entry_type: string;
  material_name_snapshot: string;
  quantity: string;
  unit_snapshot: string;
}

interface DailyLogEntryPick {
  id: string;
  log_date: Date | string;
  author_name: string;
  body_text: string | null;
}

function toDay(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

/**
 * Compact, project-scoped index of records voice actions may target. The
 * classifier can only update or delete a record whose id appears here — that is
 * what stops the model from inventing ids for records that don't exist.
 */
export function voiceReportRepository(db: Knex) {
  return {
    async snapshot(projectId: string): Promise<ProjectSnapshot> {
      const today = new Date().toISOString().slice(0, 10);
      const [rfis, changeRequests, materialOrders, lookAheads, activities, delayReasons, ledgerEntries, todayEntries] =
        await Promise.all([
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
          db<ActivityPick>("activities")
            .where({ project_id: projectId })
            .orderBy("planned_start_at", "desc")
            .limit(20)
            .select("id", "name", "status"),
          db<DelayReasonPick>("delay_reasons").limit(30).select("code", "name"),
          db<LedgerEntryPick>("material_ledger_entries")
            .where({ project_id: projectId, status: "Posted" })
            .orderBy("created_at", "desc")
            .limit(10)
            .select("id", "entry_type", "material_name_snapshot", "quantity", "unit_snapshot"),
          db<DailyLogEntryPick>("daily_log_entries")
            .where({ project_id: projectId, log_date: today })
            .orderBy("created_at", "desc")
            .limit(10)
            .select("id", "log_date", "author_name", "body_text"),
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
        activities: activities.map((a) => ({ id: a.id, name: a.name, status: a.status })),
        delayReasons: delayReasons.map((d) => ({ code: d.code, name: d.name })),
        ledgerEntries: ledgerEntries.map((e) => ({
          id: e.id,
          entryType: e.entry_type,
          materialName: e.material_name_snapshot,
          quantity: Number(e.quantity),
          unit: e.unit_snapshot,
        })),
        todayEntries: todayEntries.map((e) => ({
          id: e.id,
          logDate: toDay(e.log_date),
          authorName: e.author_name,
          snippet: (e.body_text ?? "").slice(0, 80),
        })),
      };
    },
  };
}

export type VoiceReportRepository = ReturnType<typeof voiceReportRepository>;
