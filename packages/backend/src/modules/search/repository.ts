import type { Knex } from "knex";

export interface SearchScope {
  userId: string;
  orgIds: string[];
  participantProjectIds: string[];
  pattern: string;
  limit: number;
}

export interface ProjectHitRow {
  id: string;
  name: string;
  address: string;
}

export interface UpdateHitRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  category: string;
}

export interface DocumentHitRow {
  id: string;
  project_id: string;
  file_name: string;
  category_name: string | null;
}

export interface InspectionHitRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  category: string;
}

function visibleProjectIds(db: Knex, { userId, orgIds, participantProjectIds }: SearchScope): Knex.QueryBuilder {
  return db("projects")
    .where(function () {
      this.where("owner_id", userId);
      if (orgIds.length) this.orWhereIn("organization_id", orgIds);
      if (participantProjectIds.length) this.orWhereIn("id", participantProjectIds);
    })
    .select("id");
}

export function searchRepository(db: Knex) {
  return {
    projects(scope: SearchScope): Promise<ProjectHitRow[]> {
      return db("projects")
        .whereIn("id", visibleProjectIds(db, scope))
        .andWhere(function () {
          this.where("name", "ILIKE", scope.pattern).orWhere("address", "ILIKE", scope.pattern);
        })
        .select("id", "name", "address")
        .orderBy("updated_at", "desc")
        .limit(scope.limit);
    },

    updates(scope: SearchScope): Promise<UpdateHitRow[]> {
      return db("project_updates")
        .whereIn("project_id", visibleProjectIds(db, scope))
        .andWhere(function () {
          this.where("title", "ILIKE", scope.pattern).orWhere("description", "ILIKE", scope.pattern);
        })
        .select("id", "project_id", "title", "description", "category")
        .orderBy("created_at", "desc")
        .limit(scope.limit);
    },

    documents(scope: SearchScope): Promise<DocumentHitRow[]> {
      return db("project_documents as d")
        .leftJoin("document_categories as c", "c.id", "d.category_id")
        .whereIn("d.project_id", visibleProjectIds(db, scope))
        .andWhere("d.file_name", "ILIKE", scope.pattern)
        .select(
          "d.id",
          "d.project_id",
          "d.file_name",
          db.raw("c.name as category_name"),
        )
        .orderBy("d.created_at", "desc")
        .limit(scope.limit);
    },

    inspections(scope: SearchScope): Promise<InspectionHitRow[]> {
      return db("inspections")
        .whereIn("project_id", visibleProjectIds(db, scope))
        .andWhere(function () {
          this.where("title", "ILIKE", scope.pattern).orWhere("description", "ILIKE", scope.pattern);
        })
        .select("id", "project_id", "title", "description", "category")
        .orderBy("created_at", "desc")
        .limit(scope.limit);
    },
  };
}

export type SearchRepository = ReturnType<typeof searchRepository>;
