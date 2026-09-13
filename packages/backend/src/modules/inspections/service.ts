import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { InspectionsRepository, InspectionUpdatePatch } from "./repository.ts";
import { toReport, toRequestSummary } from "./mapper.ts";
import type {
  AdminInspectionListParams,
  AssignInspectorInput,
  EditInspectionInput,
  InspectionActor,
  InspectionMediaRow,
  InspectionReport,
  InspectionRequestSummary,
  InspectionRow,
  RecordOutcomeInput,
  RequestInspectionInput,
  RequesterSide,
} from "./types.ts";
import { ForbiddenError, NotFoundError, ConflictError, BadRequestError } from "../../lib/errors.ts";

export interface InspectionsDeps {
  notifications?: NotificationsService;
}

/** Placeholder shown on the request until BuildPanda assigns someone. */
const UNASSIGNED_NAME = "Pending assignment";
const INSPECTOR_ROLE = "BuildPanda Inspector";

const NOT_THE_INSPECTOR =
  "Only the BuildPanda inspector assigned to this inspection can record findings or issue " +
  "the report. An inspection is independent of whoever is building — the contractor is its " +
  "subject, never its author.";
const NO_INSPECTOR_YET =
  "No BuildPanda inspector has been assigned to this inspection yet, so there is nobody who " +
  "may record it. Ask BuildPanda to assign an inspector.";

function notifyInspectionFailed(
  deps: InspectionsDeps,
  recipientId: string | null | undefined,
  projectId: string,
  title: string,
  actorId: string,
): void {
  if (!deps.notifications || !recipientId || recipientId === actorId) return;
  void deps.notifications
    .notify(recipientId, "inspection_failed", {
      title: "Inspection requires action",
      body: title,
      projectId,
    })
    .catch(() => undefined);
}

export function inspectionsService(
  repository: InspectionsRepository,
  deps: InspectionsDeps = {},
) {
  async function loadProjectInspection(
    projectId: string,
    inspectionId: string,
  ): Promise<InspectionRow> {
    const row = await repository.findById(inspectionId);
    if (!row || row.project_id !== projectId) {
      throw new NotFoundError("Inspection");
    }
    return row;
  }

  /**
   * The independence rule, in one place. Recording what was found on site is
   * the inspector's act: the builder may read the report, never write it.
   * Platform admins (BuildPanda staff) stand in for an inspector who cannot.
   */
  function assertIsAssignedInspector(row: InspectionRow, actor: InspectionActor): void {
    if (actor.isPlatformAdmin) return;
    if (!row.inspector_user_id) throw new ForbiddenError(NO_INSPECTOR_YET);
    if (row.inspector_user_id !== actor.id) throw new ForbiddenError(NOT_THE_INSPECTOR);
  }

  async function reload(row: InspectionRow): Promise<InspectionReport> {
    const media = await repository.mediaForInspections([row.id]);
    return toReport(row, media);
  }

  return {
    async listByProject(projectId: string): Promise<InspectionReport[]> {
      const rows = await repository.listByProject(projectId);
      if (rows.length === 0) return [];
      const media = await repository.mediaForInspections(rows.map((r) => r.id));
      const grouped = new Map<string, InspectionMediaRow[]>();
      for (const m of media) {
        const list = grouped.get(m.inspection_id) ?? [];
        list.push(m);
        grouped.set(m.inspection_id, list);
      }
      return rows.map((row) => toReport(row, grouped.get(row.id) ?? []));
    },

    /**
     * A service order, not a self-assessment. The caller is the requester, the
     * project's contractor entity is the subject unless a third-party builder is
     * named, and nobody is inspecting anything until BuildPanda assigns someone.
     */
    async request(
      projectId: string,
      input: RequestInspectionInput,
      actor: InspectionActor,
      side: RequesterSide,
    ): Promise<InspectionReport> {
      const subject = await repository.projectSubject(projectId);
      const row = await repository.create({
        id: generateId("insp"),
        project_id: projectId,
        inspector_id: generateId("person"),
        inspector_name: UNASSIGNED_NAME,
        inspector_role: INSPECTOR_ROLE,
        inspector_initials_tone: "brand",
        inspector_user_id: null,
        title: input.title,
        category: input.category,
        description: input.description,
        description_html: input.descriptionHtml ?? null,
        status: "Scheduled",
        service_status: "Requested",
        risk_level: "Low",
        scheduled_at: input.scheduledAt,
        activity_id: input.activityId ?? null,
        location: input.location?.trim() || null,
        hold_point: input.holdPoint ?? false,
        requested_by_id: actor.id,
        requested_by_side: side,
        contractor_name: input.contractorName?.trim() || subject?.contractor_entity || null,
        // Logged, not transacted: the fee is what a human agreed off-platform.
        fee_amount: input.feeAmount ?? null,
        fee_currency: input.feeCurrency ?? subject?.currency ?? null,
      });
      return toReport(row, []);
    },

    /**
     * Editing the request — its title, date, location, the party being inspected.
     * Moving `status` is not an edit: it is the outcome, so it goes through the
     * same independence gate as recording findings.
     */
    async edit(
      projectId: string,
      inspectionId: string,
      input: EditInspectionInput,
      actor: InspectionActor,
    ): Promise<InspectionReport> {
      const existing = await loadProjectInspection(projectId, inspectionId);
      if (input.status !== undefined || input.riskLevel !== undefined) {
        assertIsAssignedInspector(existing, actor);
      }

      const patch: InspectionUpdatePatch = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.category !== undefined) patch.category = input.category;
      if (input.description !== undefined) patch.description = input.description;
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      if (input.scheduledAt !== undefined) patch.scheduled_at = input.scheduledAt;
      if (input.status !== undefined) patch.status = input.status;
      if (input.riskLevel !== undefined) patch.risk_level = input.riskLevel;
      if (input.activityId !== undefined) patch.activity_id = input.activityId;
      if (input.location !== undefined) patch.location = input.location?.trim() || null;
      if (input.holdPoint !== undefined) patch.hold_point = input.holdPoint;
      if (input.contractorName !== undefined) {
        patch.contractor_name = input.contractorName?.trim() || null;
      }
      if (input.feeAmount !== undefined) patch.fee_amount = input.feeAmount;
      if (input.feeCurrency !== undefined) patch.fee_currency = input.feeCurrency;

      const updated = await repository.update(inspectionId, patch);
      if (!updated) throw new ConflictError("Inspection update failed");
      if (input.status === "Action Required" && existing.status !== "Action Required") {
        const recipient = existing.requested_by_id ?? (await repository.projectOwnerId(projectId));
        notifyInspectionFailed(deps, recipient, projectId, updated.title, actor.id);
      }
      return reload(updated);
    },

    /** The inspector confirming they attended site, before the report is written. */
    async markAttended(
      projectId: string,
      inspectionId: string,
      actor: InspectionActor,
    ): Promise<InspectionReport> {
      const existing = await loadProjectInspection(projectId, inspectionId);
      assertIsAssignedInspector(existing, actor);
      if (existing.service_status === "Cancelled") {
        throw new ConflictError("This inspection was cancelled");
      }
      const updated = await repository.update(inspectionId, { service_status: "Attended" });
      if (!updated) throw new ConflictError("Inspection update failed");
      return reload(updated);
    },

    /**
     * Pass or fail, recorded once by the assigned inspector with who inspected it
     * and when. A fail is not a status move: it carries findings and a
     * re-inspection date, and the request is rescheduled to that date so it does
     * not vanish off the programme (finding F45). Recording the outcome issues
     * the report.
     */
    async recordOutcome(
      projectId: string,
      inspectionId: string,
      input: RecordOutcomeInput,
      actor: InspectionActor,
    ): Promise<InspectionReport> {
      const existing = await loadProjectInspection(projectId, inspectionId);
      assertIsAssignedInspector(existing, actor);
      if (existing.service_status === "Cancelled") {
        throw new ConflictError("This inspection was cancelled — it cannot be reported on");
      }
      if (input.outcome === "fail" && !input.findings?.trim()) {
        throw new BadRequestError("A failed inspection needs findings — say what was wrong");
      }

      const now = new Date();
      const patch: InspectionUpdatePatch = {
        outcome: input.outcome,
        findings: input.findings?.trim() || null,
        inspected_at: now,
        inspected_by_id: actor.id,
        inspected_by_name: actor.name,
        status: input.outcome === "pass" ? "Completed" : "Action Required",
        service_status: "Reported",
        report_issued_at: now,
      };
      if (input.outcome === "fail" && input.reinspectionDate) {
        patch.reinspection_date = input.reinspectionDate;
        // The re-inspection date IS the new scheduled date; leaving the original
        // in place is how a failed inspection quietly disappears.
        patch.scheduled_at = input.reinspectionDate;
      }

      const updated = await repository.update(inspectionId, patch);
      if (!updated) throw new ConflictError("Inspection update failed");

      if (input.media?.length) {
        const base = await repository.maxMediaOrder(inspectionId);
        await repository.addMedia(
          input.media.map((item, index) => ({
            id: generateId("inspm"),
            inspection_id: inspectionId,
            type: item.type,
            url: item.url,
            sort_order: base + index + 1,
          })),
        );
      }

      if (input.outcome === "fail" && existing.status !== "Action Required") {
        const recipient = existing.requested_by_id ?? (await repository.projectOwnerId(projectId));
        notifyInspectionFailed(deps, recipient, projectId, updated.title, actor.id);
      }
      return reload(updated);
    },

    /**
     * The client who ordered the service calls it off, or BuildPanda does. The
     * contractor being inspected does not get to cancel the inspection of its
     * own work.
     */
    async cancel(
      projectId: string,
      inspectionId: string,
      actor: InspectionActor,
    ): Promise<InspectionReport> {
      const existing = await loadProjectInspection(projectId, inspectionId);
      if (!actor.isPlatformAdmin && existing.requested_by_id !== actor.id) {
        throw new ForbiddenError(
          "Only the person who requested this inspection, or BuildPanda, can cancel it",
        );
      }
      if (existing.service_status === "Reported") {
        throw new ConflictError("The report has been issued — this inspection cannot be cancelled");
      }
      const updated = await repository.update(inspectionId, { service_status: "Cancelled" });
      if (!updated) throw new ConflictError("Inspection update failed");
      return reload(updated);
    },

    /**
     * Null when the request is fine; otherwise the reason a PM should look twice
     * — you cannot inspect work that has not started (finding F44).
     */
    async warnUnstartedActivity(activityId: string | null | undefined): Promise<string | null> {
      if (!activityId) return null;
      const activity = await repository.activityProgress(activityId);
      if (!activity) return null;
      if (activity.status !== "Planned" || activity.actual_start_at) return null;
      return `${activity.name} has not started yet — check the date before the inspector travels.`;
    },

    /**
     * An issued report is an independent record of what was found on site — the
     * party it was written about does not get to make it disappear. Cancel an
     * inspection that is not wanted; delete only one that never happened.
     */
    async remove(
      projectId: string,
      inspectionId: string,
      actor: InspectionActor,
    ): Promise<void> {
      const existing = await loadProjectInspection(projectId, inspectionId);
      if (existing.service_status === "Reported" && !actor.isPlatformAdmin) {
        throw new ConflictError(
          "The report has been issued — this inspection is a record and cannot be deleted",
        );
      }
      await repository.deleteInspection(inspectionId);
    },

    // --- BuildPanda platform operations ------------------------------------

    async listRequests(
      params: AdminInspectionListParams,
    ): Promise<{ rows: InspectionRequestSummary[]; total: number }> {
      const [rows, total] = await Promise.all([
        repository.adminList(params),
        repository.adminCount(params),
      ]);
      return { rows: rows.map(toRequestSummary), total };
    },

    /**
     * BuildPanda putting one of its own inspectors on a request. Assigning is
     * what turns a request into a scheduled visit, and it is the only way an
     * account gains the right to record the outcome.
     */
    async assignInspector(
      inspectionId: string,
      input: AssignInspectorInput,
      actor: InspectionActor,
    ): Promise<InspectionRequestSummary> {
      if (!actor.isPlatformAdmin) {
        throw new ForbiddenError("Only BuildPanda can assign an inspector");
      }
      const existing = await repository.findById(inspectionId);
      if (!existing) throw new NotFoundError("Inspection");
      if (existing.service_status === "Cancelled") {
        throw new ConflictError("This inspection was cancelled");
      }
      const inspector = await repository.userById(input.inspectorUserId);
      if (!inspector) throw new NotFoundError("Inspector");

      // Assignment is also an access grant: the inspector joins the project as
      // a consultant participant so they can open the job they are reporting on.
      await repository.attachInspectorToProject(existing.project_id, inspector);

      const patch: InspectionUpdatePatch = {
        inspector_user_id: inspector.id,
        inspector_name: inspector.name ?? UNASSIGNED_NAME,
        inspector_role: input.role ?? INSPECTOR_ROLE,
        service_status: existing.service_status === "Requested" ? "Scheduled" : existing.service_status,
      };
      if (input.scheduledAt) patch.scheduled_at = input.scheduledAt;

      const updated = await repository.update(inspectionId, patch);
      if (!updated) throw new ConflictError("Inspection update failed");
      const summary = await repository.adminFindById(inspectionId);
      if (!summary) throw new NotFoundError("Inspection");
      return toRequestSummary(summary);
    },
  };
}

export type InspectionsService = ReturnType<typeof inspectionsService>;
