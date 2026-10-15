import type { Knex } from "knex";

export function documentsAgentRepository(db: Knex) {
  return {
    documents(projectId: string) {
      return db("project_documents as d")
        .leftJoin("document_categories as c", "c.id", "d.category_id")
        .where("d.project_id", projectId)
        .orderBy("d.created_at", "desc")
        .select(
          "d.id",
          "d.file_name",
          "d.current_version_id",
          "c.name as categoryName",
          "c.group as categoryGroup",
        );
    },

    documentFile(projectId: string, documentId: string) {
      return db("project_documents as d")
        .leftJoin("document_categories as c", "c.id", "d.category_id")
        .leftJoin("document_versions as v", "v.id", "d.current_version_id")
        .leftJoin("uploaded_files as f", "f.id", "v.file_id")
        .where("d.project_id", projectId)
        .where("d.id", documentId)
        .first<{
          id: string;
          file_name: string;
          storage_path: string | null;
          mime_type: string | null;
          categoryName: string | null;
          categoryGroup: string | null;
        }>(
          "d.id",
          "d.file_name",
          "f.storage_path",
          "f.mime_type",
          "c.name as categoryName",
          "c.group as categoryGroup",
        );
    },

    drawingMarkupsOpen(projectId: string) {
      return db("drawing_markups as m")
        .join("project_documents as d", "d.id", "m.document_id")
        .leftJoin("document_versions as v", "v.id", "m.document_version_id")
        .leftJoin("drawing_markup_comments as c", "c.markup_id", "m.id")
        .leftJoin("user as u", "u.id", "c.created_by_id")
        .leftJoin("rfis as r", "r.source_markup_id", "m.id")
        .where("m.project_id", projectId)
        .whereNull("m.resolved_at")
        .orderBy("m.created_at", "desc")
        .limit(50)
        .select(
          "m.id",
          "d.file_name as sheet",
          "v.revision_label as revision",
          db.raw("(d.current_version_id = m.document_version_id) as on_current_revision"),
          "m.kind",
          "c.body as comment",
          "u.name as raisedBy",
          "m.created_at",
          "r.id as rfiId",
        );
    },
  };
}
