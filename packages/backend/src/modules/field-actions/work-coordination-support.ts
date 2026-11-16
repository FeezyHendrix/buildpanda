import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { sanitizeHtmlFields } from "../../lib/rich-text.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { buildingsService } from "../buildings/service.ts";
import { workCoordinationSchemas } from "./work-coordination-schemas.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolContext, FieldToolInput } from "./tool-types.ts";

export function coordinationPayload(input: FieldToolInput): Record<string, unknown> {
  const schema = workCoordinationSchemas[input.kind as keyof typeof workCoordinationSchemas];
  if (!schema) throw new BadRequestError("Unknown work coordination action.");
  const payload = validateFieldPayload<Record<string, unknown>>(schema, structuredClone(input.payload));
  return validateFieldPayload(schema, sanitizeHtmlFields(payload));
}

export function bodyWithoutTarget<T>(payload: Record<string, unknown>, target: string, schema: object): T {
  const { [target]: _id, ...body } = payload;
  return validateFieldPayload<T>(schema, body);
}

export async function coordinationBuilding(context: FieldToolContext, explicit?: string | null): Promise<string> {
  if (explicit && context.buildingId && explicit !== context.buildingId) throw new BadRequestError("The reviewed building has changed. Select its building again.");
  const buildings = buildingsRepository(context.db);
  const buildingId = explicit ?? context.buildingId ?? await buildings.soleRealBuildingId(context.project.id);
  if (!buildingId) throw new BadRequestError("Choose a building before confirming this action.");
  await buildingsService(buildings).assertRealBuilding(context.project.id, buildingId);
  return buildingId;
}

export function assertCoordinationScope(input: FieldToolInput, context: FieldToolContext): void {
  if (input.projectId !== context.project.id || input.buildingId !== context.buildingId) throw new NotFoundError("Reviewed project scope");
}

export function assertTargetBuilding(context: FieldToolContext, buildingId: string): void {
  if (context.buildingId && context.buildingId !== buildingId) throw new NotFoundError("Record in the selected building");
}
