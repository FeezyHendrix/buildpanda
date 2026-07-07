import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import type { OrgDataCommitmentRow } from "./types.ts";

export interface NewCommitmentRecord {
  orgId: string;
  version: string;
  acceptedByUserId: string | null;
  acceptedByName: string;
}

export function dataCommitmentRepository(db: Knex) {
  return {
    findForOrgVersion(orgId: string, version: string): Promise<OrgDataCommitmentRow | undefined> {
      return db<OrgDataCommitmentRow>("org_data_commitments")
        .where({ org_id: orgId, version })
        .first();
    },

    async accept(record: NewCommitmentRecord): Promise<OrgDataCommitmentRow> {
      const [row] = await db<OrgDataCommitmentRow>("org_data_commitments")
        .insert({
          id: generateId("odc"),
          org_id: record.orgId,
          version: record.version,
          accepted_by_user_id: record.acceptedByUserId,
          accepted_by_name: record.acceptedByName,
        })
        .onConflict(["org_id", "version"])
        .ignore()
        .returning("*");
      return row ?? (await this.findForOrgVersion(record.orgId, record.version))!;
    },
  };
}

export type DataCommitmentRepository = ReturnType<typeof dataCommitmentRepository>;
