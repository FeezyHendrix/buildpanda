import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { Activity } from "./types.ts";

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

/** One row per activity, the way a planner reads a programme off a sheet. */
export function programmeRows(activities: Activity[]) {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const ordered = [...activities].sort((a, b) => Date.parse(a.plannedStartAt) - Date.parse(b.plannedStartAt));
  return ordered.map((a) => ({
    wbs: a.wbsCode ?? "",
    parent: a.parentActivityId ? (byId.get(a.parentActivityId)?.name ?? "") : "",
    name: a.name,
    kind: a.isSummary ? "Summary" : a.isMilestone ? "Milestone" : "Task",
    plannedStart: day(a.plannedStartAt),
    plannedEnd: day(a.plannedEndAt),
    baselineStart: day(a.baselineStartAt),
    baselineEnd: day(a.baselineEndAt),
    durationDays: a.durationDays ?? "",
    percentComplete: Math.round(a.percentComplete),
    status: a.status,
    predecessors: a.predecessors
      .map((p) => `${byId.get(p.activityId)?.wbsCode ?? byId.get(p.activityId)?.name ?? p.activityId} ${p.type}${p.lagDays ? `+${p.lagDays}d` : ""}`)
      .join("; "),
    delays: a.delays.map((d) => `${d.reasonName}: ${d.daysLost}d${d.resolvedAt ? "" : " (open)"}`).join("; "),
  }));
}

const COLUMNS: { key: keyof ReturnType<typeof programmeRows>[number]; header: string; width: number }[] = [
  { key: "wbs", header: "WBS", width: 10 },
  { key: "parent", header: "Parent", width: 24 },
  { key: "name", header: "Activity", width: 40 },
  { key: "kind", header: "Type", width: 10 },
  { key: "plannedStart", header: "Planned start", width: 13 },
  { key: "plannedEnd", header: "Planned end", width: 13 },
  { key: "baselineStart", header: "Baseline start", width: 13 },
  { key: "baselineEnd", header: "Baseline end", width: 13 },
  { key: "durationDays", header: "Duration (days)", width: 14 },
  { key: "percentComplete", header: "% complete", width: 11 },
  { key: "status", header: "Status", width: 12 },
  { key: "predecessors", header: "Predecessors", width: 30 },
  { key: "delays", header: "Delays", width: 40 },
];

export async function programmeToXlsx(projectName: string, activities: Activity[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Programme");
  sheet.columns = COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  for (const row of programmeRows(activities)) sheet.addRow(row);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  workbook.creator = projectName;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** A printable table of the programme: what the chart shows, row by row. */
export function programmeToPdf(projectName: string, activities: Activity[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(`${projectName} — Programme of work`);
    doc.fontSize(9).fillColor("#666").text(`Exported ${new Date().toISOString().slice(0, 10)}`).fillColor("#000").moveDown();
    const cols: [string, number][] = [["Activity", 250], ["Type", 55], ["Start", 60], ["End", 60], ["Baseline end", 70], ["%", 30], ["Status", 65], ["Delays", 170]];
    const left = doc.page.margins.left;
    const header = () => {
      let x = left;
      doc.font("Helvetica-Bold").fontSize(8);
      for (const [label, width] of cols) {
        doc.text(label, x, doc.y, { width, continued: false, lineBreak: false });
        x += width;
      }
      doc.moveDown(0.8).font("Helvetica");
    };
    header();
    for (const r of programmeRows(activities)) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 24) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      const cells = [(r.parent ? "   " : "") + r.name, r.kind, r.plannedStart, r.plannedEnd, r.baselineEnd, `${r.percentComplete}`, r.status, r.delays];
      let x = left;
      cells.forEach((cell, i) => {
        doc.text(cell, x, y, { width: cols[i]![1] - 4, lineBreak: false, ellipsis: true });
        x += cols[i]![1];
      });
      doc.y = y + 12;
    }
    doc.end();
  });
}
