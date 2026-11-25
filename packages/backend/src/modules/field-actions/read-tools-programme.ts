import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { runQueries } from "../../lib/run-queries.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { keyDatesRepository } from "../key-dates/repository.ts";
import { keyDatesService } from "../key-dates/service.ts";
import { buildActivityServices } from "../activities/wiring.ts";
import { activityReferencesService } from "../activities/references-service.ts";
import { activityReferencesRepository } from "../activities/references-repository.ts";
import { buildStagesReadService } from "../stages/wiring.ts";
import { expenseReaderId } from "../transactions/access.ts";
import { readTool, targetFields, buildingFields, textArg } from "./read-tools-support.ts";

export function programmeReadTools() {
  return [
    readTool("read_activity", "Read programme activities, or an activity with its delay history and change events. view=references reads linked look-aheads and delay blockers with activities:view permission.", {
      ...targetFields, ...buildingFields, view: { type: "string", enum: ["detail", "references", "delayReasons"] },
    }, async (context, args) => {
      const { service, delays } = buildActivityServices(context.db);
      if (args.view === "delayReasons") return service.listReasons();
      const id = textArg(args, "targetId");
      if (!id) return service.listByProject(context.project.id, context.buildingId ?? undefined);
      const activity = await service.getById(context.project.id, id);
      if (context.buildingId && activity.buildingId !== context.buildingId) throw new NotFoundError("Activity in selected building");
      if (args.view === "references") {
        await context.request.requireProjectPermission(context.project.id, "activities", "view");
        return activityReferencesService(activityReferencesRepository(context.db)).get(context.project.id, id);
      }
      const [events, delayHistory] = await runQueries(context.db, [() => service.listEvents(context.project.id, id), () => delays.listForActivity(context.project.id, id)]);
      return { activity, events, delays: delayHistory };
    }),
    readTool("read_stage", "Read project stages and recorded progress/cost rollups, or one stage. Reading never creates a contract. Expense visibility follows the caller's grants.", {
      ...targetFields, ...buildingFields,
    }, async (context, args) => {
      const service = buildStagesReadService(context.db, expenseReaderId(context.request, context.project));
      const stages = await service.list(context.project.id, context.buildingId ?? undefined);
      const id = textArg(args, "targetId");
      if (!id) return stages;
      const stage = stages.find((record) => record.id === id);
      if (!stage) throw new NotFoundError("Stage");
      return stage;
    }),
    readTool("read_key_date", "Read contractual and project key dates, actual/target dates, notes and linked activity, optionally within a building.", {
      ...targetFields, ...buildingFields,
    }, async (context, args) => {
      const service = keyDatesService(keyDatesRepository(context.db), async (projectId, explicit) => {
        const buildingId = explicit ?? await buildingsRepository(context.db).soleRealBuildingId(projectId);
        if (!buildingId) throw new BadRequestError("Choose a building.");
        return buildingId;
      });
      const dates = await service.list(context.project.id, context.buildingId ?? undefined);
      const id = textArg(args, "targetId");
      if (!id) return dates;
      const date = dates.find((record) => record.id === id);
      if (!date) throw new NotFoundError("Key date");
      return date;
    }),
  ];
}
