import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { config } from "../../config/index.ts";
import { buildActivityServices } from "../activities/wiring.ts";
import { raiseDelayBody } from "../activities/route-schemas.ts";
import type { RaiseDelayInput } from "../activities/types.ts";
import { buildStagesService } from "../stages/wiring.ts";
import { stagesRepository } from "../stages/repository.ts";
import { expenseReaderId } from "../transactions/access.ts";
import { buildDailyLogsService } from "../daily-logs/wiring.ts";
import { linkActivityBody } from "../daily-logs/schemas.ts";
import type { LinkActivityInput } from "../daily-logs/types.ts";
import { assertTargetBuilding, coordinationPayload, coordinationBuilding } from "./work-coordination-support.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler } from "./tool-types.ts";
import { requireCoordinationReferences } from "./work-coordination-references.ts";

function today(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (kind: string) => parts.find((entry) => entry.type === kind)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const activityHandler: FieldToolHandler = async (input, context) => {
  const payload = coordinationPayload(input);
  const { project, request, user } = context;
  await request.requireProjectPermission(project.id, "dailyLog", "create");
  await context.requireFeature("quality.dailyLogs", "Daily logs");
  const { repository, delays, flush } = buildActivityServices(context.db, context.queue);
  const activityId = payload.activityId as string;
  const activity = await repository.findById(activityId);
  if (!activity || activity.project_id !== project.id) throw new NotFoundError("Activity");
  assertTargetBuilding(context, activity.building_id);
  await coordinationBuilding(context, activity.building_id);
  const logDate = payload.logDate as string | undefined ?? today();
  const body = validateFieldPayload<LinkActivityInput>(linkActivityBody, {
    activityId, hoursLogged: payload.hoursLogged, ...(payload.postUpdate !== undefined ? { postUpdate: payload.postUpdate } : {}),
  });
  if (body.postUpdate) await request.requireProjectPermission(project.id, "updates", "post");
  if (body.postUpdate) await context.requireFeature("project.updates", "Project updates");
  const explicitDelay = payload.delay as RaiseDelayInput | undefined;
  if (explicitDelay && (payload.delayReasonCode || payload.delayNote)) throw new BadRequestError("Review one delay record, using either its full details or its reason and note.");
  if (payload.delayNote && !payload.delayReasonCode) throw new BadRequestError("Choose the reason for this delay before confirming its note.");
  let delay = explicitDelay;
  if (payload.delayReasonCode) {
    if (logDate !== today()) throw new BadRequestError("Provide the actual start time in the delay details for a historical activity log.");
    delay = { reasonCode: payload.delayReasonCode as string, description: payload.delayNote as string | undefined, startedAt: new Date().toISOString() };
  }
  if (delay) {
    await context.requireFeature("projects.schedule", "Schedule");
    await request.requireProjectPermission(project.id, "schedule", "manage");
    validateFieldPayload<RaiseDelayInput>(raiseDelayBody, delay);
    await context.requireFiles(delay);
    await requireCoordinationReferences(delay as unknown as Record<string, unknown>, context);
  }
  await buildDailyLogsService(context.db, context.queue).linkActivity(project.id, logDate, body, { id: user.id, name: user.name });
  if (delay) await delays.raise(project.id, activityId, delay, { id: user.id, name: user.name });
  await flush();
  return { kind: input.kind, projectId: project.id, recordId: `${project.id}:${activity.building_id}:${logDate}:${activityId}` };
};

const stageHandler: FieldToolHandler = async (input, context) => {
  const payload = coordinationPayload(input);
  const { project, request } = context;
  await request.requireProjectPermission(project.id, "stages", "manage");
  const stageId = payload.stageId as string;
  const stage = await stagesRepository(context.db).findById(stageId);
  if (!stage || stage.project_id !== project.id) throw new NotFoundError("Stage");
  assertTargetBuilding(context, stage.building_id);
  const buildingId = await coordinationBuilding(context, payload.buildingId as string | null | undefined ?? stage.building_id);
  if (buildingId !== stage.building_id) throw new BadRequestError("The selected stage belongs to a different building.");
  await buildStagesService(context.db, expenseReaderId(request, project)).update(project.id, stageId,
    { status: payload.status as "Pending" | "InProgress" | "Done" });
  return { kind: input.kind, projectId: project.id, recordId: stageId };
};

export const workProgrammeHandlers = { log_activity: activityHandler, transition_stage: stageHandler } satisfies Record<string, FieldToolHandler>;
