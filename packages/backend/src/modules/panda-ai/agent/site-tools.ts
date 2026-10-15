import { rfisRepository } from "../../rfis/repository.ts";
import { rfisService } from "../../rfis/service.ts";
import { notificationsRepository } from "../../notifications/repository.ts";
import { notificationsService } from "../../notifications/service.ts";
import { agentRepository } from "./repository.ts";
import { workRecordsRepository } from "./work-records.ts";
import { fn, round2, tool, type AgentTool } from "./tool-helpers.ts";
import { readableSections } from "./tool-permissions.ts";
import { diaryDates, shapeDiary } from "./diary.ts";
import { requiredString } from "./tool-input.ts";

const WORK_RECORD_SECTIONS = [
  { key: "activity", resource: "schedule", action: "view" },
  { key: "delay", resource: "schedule", action: "view" },
  { key: "rfi", resource: "rfis", action: "view" },
  { key: "change_request", resource: "change-requests", action: "view" },
  { key: "risk", resource: "risks", action: "view" },
  { key: "inspection", resource: "inspections", action: "view" },
  { key: "material_order", resource: "materials", action: "view" },
] as const;

const OPEN_ITEM_SECTIONS = [
  { key: "rfis", resource: "rfis", action: "view" },
  { key: "approvals", resource: "approvals", action: "view" },
  { key: "materialApprovals", resource: "materials", action: "view" },
] as const;

export function siteTools(): AgentTool[] {
  return [
    tool(fn("find_work_records", "Find every record on the project whose text names a particular piece of work — a structure, a location, a chainage or an element such as 'culvert 1', 'ch 0+420', 'the retaining wall', 'kerbing'. It sweeps the records that DESCRIBE WORK in one call: activities, the delays logged against them, RFIs, change requests, risks, inspections and material orders, returning each match with its status, dates and notes. ALWAYS use this FIRST for 'what changed on X', 'what is the story on X', 'what happened with X', 'is there anything open on X', or any question that names a piece of work rather than a whole domain. Drawing markups are NOT where the history of a piece of work lives — do not answer these questions from get_drawing_markups. If this returns nothing, try a shorter or differently spelled term before telling the user there is no information.", {
      term: { type: "string", description: "The thing the user named, e.g. 'culvert 1', 'ch 0+420', 'asphalt', 'retaining wall'." },
    }, ["term"]), async (ctx, args) => {
      const repo = workRecordsRepository(ctx.db);
      const term = requiredString(args.term, 120, "term");
      // Only the domains this caller could fetch through the API are swept, so
      // the sweep can never be a side door onto records they may not read.
      const { allowed, withheld } = readableSections(ctx, WORK_RECORD_SECTIONS);
      // The phrase first, so "culvert 1" beats a loose word match; only if the
      // phrase finds nothing do the words go in separately.
      let hits = await repo.workRecords(ctx.projectId, [term], allowed);
      const words = term.split(/\s+/).filter((w) => w.length > 0);
      if (hits.length === 0 && words.length > 1) {
        hits = await repo.workRecords(ctx.projectId, words, allowed);
      }
      return {
        output: {
          term,
          matchCount: hits.length,
          searched: allowed,
          notPermitted: withheld,
          records: hits,
        },
      };
    }),

    tool(fn("get_risks", "Get the project risk register (risk factors by severity, status and mitigation). Risks are usually written against a specific location or structure, so use this for questions about risks, what could go wrong, and what is threatening a named piece of work."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const risks = await repo.risks(ctx.projectId);
      return { output: risks.map((r) => ({ title: r.title, description: r.description, severity: r.severity })) };
    }),

    tool(fn("get_daily_logs", "Get the site diary day by day: the weather and temperature, workers present against workers expected, hours worked, the written diary entries for the day, and — the point of a diary — WHICH ACTIVITIES the hours went on, with the hours logged against each. Use for 'summarise the site diary', 'what happened on site', 'what work was done this week', or recent progress. Always say what work was done from each day's `activities`, not only headcounts and weather. A day whose `isFuture` is true is dated AFTER today: it is a plan somebody wrote ahead, not a record of work done — report it separately as future-dated and never fold it into a week's totals. `totals` is already computed over recorded (non-future, non-voided) days only; quote it rather than adding the rows up yourself.", { limit: { type: "number", description: "How many recent logs (default 10)" } }), async (ctx, args) => {
      const repo = agentRepository(ctx.db);
      const limit = Math.min(Math.max(Number(args.limit ?? 10), 1), 30);
      const today = new Date().toISOString().slice(0, 10);
      const logs = await repo.dailyLogs(ctx.projectId, limit);
      const dates = diaryDates(logs);
      const [hours, entries] = await Promise.all([
        repo.dailyLogActivityHours(ctx.projectId, dates),
        repo.dailyLogEntries(ctx.projectId, dates),
      ]);
      return { output: shapeDiary(logs, hours, entries, today) };
    }),

    tool(fn("get_inspections", "Get project inspections: the independent inspection service BuildPanda carries out on the client's request. Returns the service status (Requested / Scheduled / Attended / Reported / Cancelled), the assigned BuildPanda inspector, the contractor being inspected, the pass/fail outcome and any findings."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const inspections = await repo.inspections(ctx.projectId);
      return { output: inspections.map((i) => ({ title: i.title, category: i.category, status: i.status, serviceStatus: i.service_status, riskLevel: i.risk_level, scheduledAt: i.scheduled_at, inspector: i.inspector_user_name ?? i.inspector_name, contractorInspected: i.contractor_name, outcome: i.outcome, findings: i.findings, reportIssuedAt: i.report_issued_at })) };
    }),

    tool(fn("get_open_items", "Get the open items needing attention across RFIs, client approvals and material approval requests — anything unresolved with a status, owner and due date. Use for 'what needs my attention', 'what is blocking us', 'what is open or overdue', 'what is pending sign-off', or 'which materials are awaiting approval'."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const now = Date.now();
      const overdue = (d: unknown): boolean => Boolean(d) && new Date(d as string).getTime() < now;
      // Three registers behind three different permissions; the caller gets
      // only the ones their role opens, and is told which were withheld.
      const { allowed, withheld } = readableSections(ctx, OPEN_ITEM_SECTIONS);
      const may = (key: (typeof OPEN_ITEM_SECTIONS)[number]["key"]): boolean => allowed.includes(key);
      const needsApprovals = may("approvals") || may("materialApprovals");
      const [rfis, approvals] = await Promise.all([
        may("rfis") ? repo.rfisOpen(ctx.projectId) : Promise.resolve([]),
        needsApprovals ? repo.approvalsOpen(ctx.projectId) : Promise.resolve([]),
      ]);
      return {
        output: {
          rfis: rfis.map((r) => ({ title: r.title, status: r.status, priority: r.priority, dueDate: r.due_date, overdue: overdue(r.due_date) })),
          approvals: may("approvals") ? approvals.filter((a) => a.kind !== "material").map((a) => ({ title: a.title, category: a.category, status: a.status, submittedBy: a.submittedBy, dueDate: a.due_date, overdue: overdue(a.due_date) })) : [],
          materialApprovals: may("materialApprovals") ? approvals.filter((a) => a.kind === "material").map((a) => ({ title: a.title, material: a.materialName, quantity: a.materialQuantity, unit: a.materialUnit, supplier: a.materialSupplier, neededBy: a.materialNeededBy, status: a.status, submittedBy: a.submittedBy, dueDate: a.due_date, overdue: overdue(a.due_date) })) : [],
          notPermitted: withheld,
        },
      };
    }),

    tool(fn("get_change_requests", "Get the project's change requests with their cost and schedule impact and decision status. A change request is the record of a design or scope change to a specific piece of work, so use this for questions about changes, variations, scope changes, what was varied on a named element, or why the budget or timeline is moving."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const changes = await repo.changeRequests(ctx.projectId);
      return {
        output: changes.map((c) => ({
          title: c.title,
          status: c.status,
          costImpact: c.cost_impact === null ? null : Number(c.cost_impact),
          scheduleImpactDays: c.time_impact_days === null ? null : Number(c.time_impact_days),
          currency: c.currency,
          reason: c.reason,
          decidedAt: c.decided_at,
          submittedBy: c.submittedBy,
        })),
      };
    }),

    tool(fn("get_selections", "Get the homeowner's finish/fixture selections (tile, taps, lighting…) with their allowance budget, deadline, decision status, the chosen option and its price, and any overage above the allowance. Use for questions about client selections, allowances, what the homeowner has chosen or still needs to choose, and selection overages."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const now = Date.now();
      const selections = (await repo.selections(ctx.projectId)) as Array<{
        id: string;
        title: string;
        category: string | null;
        status: string;
        allowance_amount: string | null;
        currency: string;
        due_date: string | null;
        decided_at: string | null;
        change_request_id: string | null;
        chosen_option_name: string | null;
        chosen_option_price: string | null;
      }>;
      return {
        output: selections.map((s) => {
          const allowance = s.allowance_amount === null ? null : Number(s.allowance_amount);
          const chosenPrice = s.chosen_option_price === null ? null : Number(s.chosen_option_price);
          const overage =
            allowance !== null && chosenPrice !== null
              ? Math.max(0, round2(chosenPrice - allowance))
              : null;
          return {
            title: s.title,
            category: s.category,
            status: s.status,
            allowance,
            currency: s.currency,
            chosenOption: s.chosen_option_name,
            chosenPrice,
            overage,
            dueDate: s.due_date,
            isOverdue:
              Boolean(s.due_date) &&
              new Date(String(s.due_date)).getTime() < now &&
              s.status === "open",
            decidedAt: s.decided_at,
            hasChangeRequest: s.change_request_id !== null,
          };
        }),
      };
    }),

    tool(fn("get_permits", "Get the project's permits with authority, status and key dates. Use for questions about permits, approvals to start work, regulatory status, or what is expiring."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const now = Date.now();
      const permits = await repo.permits(ctx.projectId);
      return {
        output: permits.map((p) => ({
          title: p.title,
          authority: p.authority,
          reference: p.reference_no,
          status: p.status,
          appliedDate: p.applied_date,
          approvedDate: p.approved_date,
          expiryDate: p.expiry_date,
          daysToExpiry: p.expiry_date ? Math.round((new Date(p.expiry_date as string).getTime() - now) / 86_400_000) : null,
        })),
      };
    }),

    tool(fn("create_rfi", "Draft an RFI (request for information) on the project, created in Draft status and attributed to the user, so they can review, assign and send it from the RFIs page. ONLY call this when the user explicitly asks to create/raise an RFI, and confirm the subject and question with them first — never invent content. Returns the created RFI's id and number.", {
      subject: { type: "string", description: "Short RFI subject (required)" },
      question: { type: "string", description: "The full question being asked (required)" },
    }, ["subject", "question"]), async (ctx, args) => {
      // rfis:create is enforced by toolsForCaller (see tool-permissions.ts).
      const service = rfisService(rfisRepository(ctx.db), {
        notifications: notificationsService(notificationsRepository(ctx.db), ctx.queue),
      });
      const isClient = ctx.caller.projectRoles.get(ctx.projectId) === "client";
      // No ballInCourtId => the RFI starts in Draft (the earliest status).
      const rfi = await service.create(
        ctx.projectId,
        {
          subject: requiredString(args.subject, 200, "subject"),
          question: requiredString(args.question, 8000, "question"),
        },
        { id: ctx.caller.user.id, name: ctx.caller.user.name },
        isClient ? "shared" : "internal",
      );
      return {
        output: {
          created: true,
          id: rfi.id,
          number: rfi.number,
          subject: rfi.subject,
          status: rfi.status,
          page: `/project/${ctx.projectId}/rfis`,
        },
      };
    }),
  ];
}
