import type { Knex } from "knex";

declare module "fastify" {
  interface FastifyContextConfig {
    audit?: false;
    auditAction?: string;
    auditTargetType?: string;
    auditTargetParam?: string;
  }
}

export interface AdminAuditEntry {
  adminUserId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  method: string;
  path: string;
  route?: string | null;
  ip?: string | null;
  statusCode?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminAuditListParams {
  adminUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  limit: number;
  offset: number;
}

export function adminAuditRepository(db: Knex) {
  return {
    insert: (entry: AdminAuditEntry): Promise<void> =>
      db("admin_audit_log")
        .insert({
          admin_user_id: entry.adminUserId,
          action: entry.action,
          target_type: entry.targetType ?? null,
          target_id: entry.targetId ?? null,
          method: entry.method,
          path: entry.path,
          route: entry.route ?? null,
          ip: entry.ip ?? null,
          status_code: entry.statusCode ?? null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        })
        .then(() => undefined),

    list: async (params: AdminAuditListParams) => {
      const base = db("admin_audit_log as a").leftJoin("user as u", "u.id", "a.admin_user_id");
      if (params.adminUserId) base.where("a.admin_user_id", params.adminUserId);
      if (params.action) base.where("a.action", params.action);
      if (params.targetType) base.where("a.target_type", params.targetType);
      if (params.targetId) base.where("a.target_id", params.targetId);

      const totalRow = await base.clone().count<{ count: string }[]>("a.id as count").first();
      const rows = await base
        .clone()
        .select(
          "a.id",
          "a.admin_user_id as adminUserId",
          "u.name as adminName",
          "u.email as adminEmail",
          "a.action",
          "a.target_type as targetType",
          "a.target_id as targetId",
          "a.method",
          "a.path",
          "a.route",
          "a.ip",
          "a.status_code as statusCode",
          "a.metadata",
          "a.created_at as createdAt",
        )
        .orderBy("a.created_at", "desc")
        .limit(params.limit)
        .offset(params.offset);

      return { total: Number(totalRow?.count ?? 0), rows };
    },
  };
}

export type AdminAuditRepository = ReturnType<typeof adminAuditRepository>;
