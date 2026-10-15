import type { Knex } from "knex";
import { applyTaskVisibility } from "../../tasks/visibility-repository.ts";

export function tasksAgentRepository(db: Knex, readerId: string | null | undefined) {
  return {
    tasks(projectId: string) {
      return db("tasks as t")
        .modify((query) => applyTaskVisibility(query, db, readerId))
        .leftJoin("task_columns as col", "col.id", "t.column_id")
        .leftJoin("user as u", "u.id", "t.assignee_id")
        .leftJoin("team_members as tm", "tm.id", "t.assignee_team_member_id")
        .where("t.project_id", projectId)
        .orderBy("t.due_date", "asc")
        .limit(100)
        .select<{ id: string; title: string; columnName: string; due_date: string | null; assigneeUserName: string | null; assigneeTeamName: string | null }[]>(
          "t.id",
          "t.title",
          "col.name as columnName",
          "t.due_date",
          "u.name as assigneeUserName",
          "tm.name as assigneeTeamName",
        );
    },

    taskComments(projectId: string) {
      return db("task_comments as c")
        .modify((query) => applyTaskVisibility(query, db, readerId))
        .join("tasks as t", "t.id", "c.task_id")
        .where("t.project_id", projectId)
        .orderBy("c.created_at", "asc")
        .limit(200)
        .select("t.title as taskTitle", "c.author_name as authorName", "c.body", "c.created_at");
    },

    taskEntityLinks(projectId: string, allowedTypes: readonly string[] = [], internalRfis = false) {
      return db("task_entity_links as el")
        .modify((query) => applyTaskVisibility(query, db, readerId))
        .join("tasks as t", "t.id", "el.task_id")
        .leftJoin("rfis as r", function () {
          this.on("el.entity_type", db.raw("?", ["rfi"])).andOn("r.id", "el.entity_id");
        })
        .leftJoin("change_requests as cr", function () {
          this.on("el.entity_type", db.raw("?", ["change_request"])).andOn("cr.id", "el.entity_id");
        })
        .leftJoin("material_orders as mo", function () {
          this.on("el.entity_type", db.raw("?", ["material"])).andOn("mo.id", "el.entity_id");
        })
        .leftJoin("project_invoices as inv", function () {
          this.on("el.entity_type", db.raw("?", ["invoice"])).andOn("inv.id", "el.entity_id");
        })
        .leftJoin("milestone_payments as mp", function () {
          this.on("el.entity_type", db.raw("?", ["milestone_payment"])).andOn("mp.id", "el.entity_id");
        })
        .where("el.project_id", projectId)
        .where("t.project_id", projectId)
        .whereIn("el.entity_type", allowedTypes)
        .where((query) => query
          .where((rfi) => {
            rfi.where("el.entity_type", "rfi").where("r.project_id", projectId);
            if (!internalRfis) rfi.where("r.visibility", "shared");
          })
          .orWhere((link) => link.where("el.entity_type", "change_request").where("cr.project_id", projectId))
          .orWhere((link) => link.where("el.entity_type", "material").where("mo.project_id", projectId))
          .orWhere((link) => link.where("el.entity_type", "invoice").where("inv.project_id", projectId))
          .orWhere((link) => link.where("el.entity_type", "milestone_payment").where("mp.project_id", projectId)))
        .orderBy("t.title", "asc")
        .limit(200)
        .select(
          "t.title as taskTitle",
          "el.entity_type as entityType",
          db.raw(
            "COALESCE(r.subject, cr.title, mo.material_name, inv.vendor_name, mp.name) as label",
          ),
        );
    },
  };
}
