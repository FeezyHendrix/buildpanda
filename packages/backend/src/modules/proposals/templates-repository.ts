import type { Knex } from "knex";
import type {
  JobProfile,
  ProposalTemplateRow,
  TemplatePackSection,
  TemplateScheduleItem,
  TemplateTerms,
} from "./types.ts";

export type ProposalTemplatesRepository = ReturnType<typeof proposalTemplatesRepository>;

export interface EstimateSnapshot {
  contingencyPct: number;
  taxLabel: string | null;
  taxPct: number;
  terms: TemplateTerms;
  schedule: TemplateScheduleItem[];
  packSections: TemplatePackSection[];
}

// Terms columns and the pack table are added by another workstream; the
// repository probes for them once so a template round-trips whatever exists.
const TERMS_COLUMNS: { column: string; key: keyof TemplateTerms; numeric: boolean }[] = [
  { column: "retention_pct", key: "retentionPct", numeric: true },
  { column: "retention_mode", key: "retentionMode", numeric: false },
  { column: "advance_pct", key: "advancePct", numeric: true },
  { column: "wht_pct", key: "whtPct", numeric: true },
  { column: "payment_terms_days", key: "paymentTermsDays", numeric: true },
  { column: "defects_liability_days", key: "defectsLiabilityDays", numeric: true },
  { column: "client_visible_detail", key: "clientVisibleDetail", numeric: false },
];

export function proposalTemplatesRepository(db: Knex) {
  const probe = new Map<string, Promise<boolean>>();
  const hasColumn = (table: string, column: string) => {
    const key = `${table}.${column}`;
    if (!probe.has(key)) probe.set(key, db.schema.hasColumn(table, column));
    return probe.get(key)!;
  };
  const hasTable = (table: string) => {
    const key = `table:${table}`;
    if (!probe.has(key)) probe.set(key, db.schema.hasTable(table));
    return probe.get(key)!;
  };

  return {
    listByOrg: (orgId: string) =>
      db<ProposalTemplateRow>("proposal_templates").where({ org_id: orgId }).orderBy("name", "asc"),
    byId: (id: string) => db<ProposalTemplateRow>("proposal_templates").where({ id }).first(),
    insert: async (row: Omit<ProposalTemplateRow, "created_at" | "updated_at">) => {
      const [inserted] = await db<ProposalTemplateRow>("proposal_templates")
        .insert({
          ...row,
          pack_sections: JSON.stringify(row.pack_sections) as never,
          payment_schedule: JSON.stringify(row.payment_schedule) as never,
          terms: JSON.stringify(row.terms) as never,
        })
        .returning("*");
      return inserted!;
    },
    rename: async (id: string, name: string) => {
      const [updated] = await db<ProposalTemplateRow>("proposal_templates")
        .where({ id })
        .update({ name, updated_at: db.fn.now() })
        .returning("*");
      return updated;
    },
    delete: (id: string, orgId: string) => db("proposal_templates").where({ id, org_id: orgId }).delete(),

    async snapshotEstimate(proposalId: string, estimateId: string): Promise<EstimateSnapshot> {
      const estimate = await db("estimates").where({ id: estimateId }).first();
      const terms: TemplateTerms = {};
      for (const t of TERMS_COLUMNS) {
        if (estimate && (await hasColumn("estimates", t.column))) {
          const raw = estimate[t.column];
          terms[t.key] = (raw === null || raw === undefined ? null : t.numeric ? Number(raw) : raw) as never;
        }
      }
      const scheduleHasKind = await hasColumn("estimate_payment_schedule", "kind");
      const scheduleRows = await db("estimate_payment_schedule").where({ estimate_id: estimateId }).orderBy("sort", "asc");
      const schedule: TemplateScheduleItem[] = scheduleRows.map((r, i) => ({
        label: r.label,
        percent: Number(r.percent),
        description: r.description ?? null,
        kind: scheduleHasKind && r.kind === "advance" ? "advance" : "stage",
        sort: i,
      }));
      let packSections: TemplatePackSection[] = [];
      if (await hasTable("proposal_pack_sections")) {
        const rows = await db("proposal_pack_sections").where({ proposal_id: proposalId }).orderBy("sort", "asc");
        packSections = rows.map((r, i) => ({ kind: r.kind, bodyHtml: r.body_html ?? "", sort: i }));
      }
      return {
        contingencyPct: Number(estimate?.contingency_pct ?? 0),
        taxLabel: estimate?.tax_label ?? null,
        taxPct: Number(estimate?.tax_pct ?? 0),
        terms,
        schedule,
        packSections,
      };
    },

    async proposalJobProfile(proposalId: string): Promise<JobProfile | null> {
      if (!(await hasColumn("proposals", "job_profile"))) return null;
      const row = await db("proposals").where({ id: proposalId }).select("job_profile").first();
      return (row?.job_profile as JobProfile | undefined) ?? null;
    },

    async setProposalJobProfile(proposalId: string, jobProfile: JobProfile): Promise<void> {
      if (!(await hasColumn("proposals", "job_profile"))) return;
      await db("proposals").where({ id: proposalId }).update({ job_profile: jobProfile });
    },

    // Applies everything the template carries that the schema can hold today.
    async applyToEstimate(
      proposalId: string,
      estimateId: string,
      tpl: ProposalTemplateRow,
      scheduleIds: string[],
      packIds: string[],
      userId: string,
    ): Promise<void> {
      const patch: Record<string, unknown> = {
        contingency_pct: Number(tpl.contingency_pct),
        tax_pct: Number(tpl.tax_pct),
        updated_at: new Date().toISOString(),
      };
      if (tpl.tax_label) patch["tax_label"] = tpl.tax_label;
      for (const t of TERMS_COLUMNS) {
        const value = tpl.terms[t.key];
        if (value !== undefined && (await hasColumn("estimates", t.column))) patch[t.column] = value;
      }
      const scheduleHasKind = await hasColumn("estimate_payment_schedule", "kind");
      const packTable = await hasTable("proposal_pack_sections");
      await db.transaction(async (trx) => {
        await trx("estimates").where({ id: estimateId }).update(patch);
        await trx("estimate_payment_schedule").where({ estimate_id: estimateId }).delete();
        if (tpl.payment_schedule.length) {
          await trx("estimate_payment_schedule").insert(
            tpl.payment_schedule.map((item, i) => ({
              id: scheduleIds[i],
              estimate_id: estimateId,
              label: item.label,
              percent: item.percent,
              description: item.description,
              sort: i,
              ...(scheduleHasKind ? { kind: item.kind } : {}),
            })),
          );
        }
        if (packTable && tpl.pack_sections.length) {
          await trx("proposal_pack_sections").where({ proposal_id: proposalId }).delete();
          await trx("proposal_pack_sections").insert(
            tpl.pack_sections.map((section, i) => ({
              id: packIds[i],
              proposal_id: proposalId,
              estimate_id: estimateId,
              kind: section.kind,
              body_html: section.bodyHtml,
              sort: i,
              origin: "template",
              updated_by: userId,
            })),
          );
        }
      });
    },
  };
}
