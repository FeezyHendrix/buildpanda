import type { Knex } from "knex";

export interface SearchScope {
  userId: string;
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

function visibleProjectIds(db: Knex, userId: string): Knex.QueryBuilder {
  return db("projects")
    .where(function () {
      this.where("owner_id", userId).orWhereNull("owner_id");
    })
    .select("id");
}

export function searchRepository(db: Knex) {
  return {
    projects({ userId, pattern, limit }: SearchScope): Promise<ProjectHitRow[]> {
      return db("projects")
        .where(function () {
          this.where("owner_id", userId).orWhereNull("owner_id");
        })
        .andWhere(function () {
          this.where("name", "ILIKE", pattern).orWhere("address", "ILIKE", pattern);
        })
        .select("id", "name", "address")
        .orderBy("updated_at", "desc")
        .limit(limit);
    },

    updates({ userId, pattern, limit }: SearchScope): Promise<UpdateHitRow[]> {
      return db("project_updates")
        .whereIn("project_id", visibleProjectIds(db, userId))
        .andWhere(function () {
          this.where("title", "ILIKE", pattern).orWhere("description", "ILIKE", pattern);
        })
        .select("id", "project_id", "title", "description", "category")
        .orderBy("created_at", "desc")
        .limit(limit);
    },

    documents({ userId, pattern, limit }: SearchScope): Promise<DocumentHitRow[]> {
      return db("project_documents as d")
        .leftJoin("document_categories as c", "c.id", "d.category_id")
        .whereIn("d.project_id", visibleProjectIds(db, userId))
        .andWhere("d.file_name", "ILIKE", pattern)
        .select(
          "d.id",
          "d.project_id",
          "d.file_name",
          db.raw("c.name as category_name"),
        )
        .orderBy("d.created_at", "desc")
        .limit(limit);
    },

    inspections({ userId, pattern, limit }: SearchScope): Promise<InspectionHitRow[]> {
      return db("inspections")
        .whereIn("project_id", visibleProjectIds(db, userId))
        .andWhere(function () {
          this.where("title", "ILIKE", pattern).orWhere("description", "ILIKE", pattern);
        })
        .select("id", "project_id", "title", "description", "category")
        .orderBy("created_at", "desc")
        .limit(limit);
    },
  };
}

export type SearchRepository = ReturnType<typeof searchRepository>;
