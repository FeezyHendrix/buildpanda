import type { Knex } from "knex";
import { buildingsRepository } from "../buildings/repository.ts";
import { lookAheadsRepository } from "./repository.ts";
import { lookAheadsService } from "./service.ts";

export function buildLookAheadsService(db: Knex) {
  return lookAheadsService(lookAheadsRepository(db), buildingsRepository(db).soleRealBuildingId);
}
