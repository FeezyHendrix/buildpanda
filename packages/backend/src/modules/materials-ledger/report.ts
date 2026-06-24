import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import { renderMaterialReportPdf, type MaterialReportPdfData } from "../../lib/material-report-pdf.ts";
import { makeReportImageResolver } from "../../lib/report-image-resolver.ts";
import { renderEmail, metaTable, infoRow } from "../../lib/email-templates.ts";
import { sendEmail } from "../../lib/mail.ts";
import { config } from "../../config/index.ts";
import { projectsRepository } from "../projects/repository.ts";
import type { FilesService } from "../files/service.ts";
import type { MaterialsLedgerService } from "./service.ts";
import type { LedgerEntry } from "./types.ts";

const ENTRY_TYPE_LABEL: Record<string, string> = {
  IN: "IN",
  USED: "USED",
  VOID: "VOID",
};

function formatLongDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export interface MaterialReportResult {
  pdf: Buffer;
  fileName: string;
  data: MaterialReportPdfData;
}

export interface MaterialReportDeps {
  ledger: MaterialsLedgerService;
  files: FilesService;
}

export function materialReportService(db: Knex, deps: MaterialReportDeps) {
  const projects = projectsRepository(db);
  const resolveImage = makeReportImageResolver(deps.files);

  async function build(projectId: string): Promise<MaterialReportResult> {
    const project = await projects.findById(projectId);
    if (!project) throw new NotFoundError("Project");

    let companyName = "BuildPanda";
    if (project.organization_id) {
      const org = await db("organization")
        .where({ id: project.organization_id })
        .first<{ name: string } | undefined>("name");
      if (org?.name) companyName = org.name;
    }

    const stock = await deps.ledger.getStock(projectId);
    const entries: LedgerEntry[] = await deps.ledger.listLedger(projectId, { limit: 200 });
    const now = new Date().toISOString();

    const data: MaterialReportPdfData = {
      companyName,
      projectName: project.name,
      projectAddress: project.address,
      reportDateLabel: formatLongDate(now),
      generatedAtLabel: formatTimestamp(now),
      stock: stock.map((s) => ({
        material: s.materialName,
        unit: s.unit,
        onHand: String(s.onHandQty),
        lowStock: s.lowStock,
      })),
      entries: entries.map((e) => ({
        type: ENTRY_TYPE_LABEL[e.entryType] ?? e.entryType,
        material: e.materialName,
        quantity: String(e.quantity),
        unit: e.unit,
        occurredAt: formatTimestamp(e.occurredAt),
        loggedBy: e.loggedByName,
        reason: e.reason,
        notesHtml: e.notesHtml,
        voided: e.status === "Voided",
      })),
    };

    const pdf = await renderMaterialReportPdf(data, { resolveImage });
    const fileName = `material-report-${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${now.slice(0, 10)}.pdf`;
    return { pdf, fileName, data };
  }

  async function emailTo(
    projectId: string,
    recipient: { email: string; name: string },
  ): Promise<MaterialReportResult> {
    const report = await build(projectId);
    const projectUrl = `${config.mail.appUrl.replace(/\/+$/, "")}/project/${projectId}/material-log`;

    const rows = [
      infoRow("Project", report.data.projectName),
      infoRow("Materials tracked", String(report.data.stock.length)),
      infoRow("Movements", String(report.data.entries.length)),
    ].join("");

    const html = renderEmail({
      preview: `Material report — ${report.data.projectName}`,
      eyebrow: "Material report",
      heading: "Your material report is ready",
      bodyHtml: `<p style="margin:0 0 16px 0;">The material report for <strong>${report.data.projectName}</strong> is attached as a PDF.</p>${metaTable(rows)}`,
      cta: { label: "Open material log", url: projectUrl },
      footnote: "You received this because you requested a material report in BuildPanda.",
    });

    await sendEmail({
      to: recipient.email,
      toName: recipient.name,
      subject: `Material Report — ${report.data.projectName} — ${report.data.reportDateLabel}`,
      html,
      attachments: [{ content: report.pdf, name: report.fileName, mimeType: "application/pdf" }],
    });

    return report;
  }

  return { build, emailTo };
}

export type MaterialReportService = ReturnType<typeof materialReportService>;
