import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export interface PeriodReportKpi {
  label: string;
  value: string;
}

export interface PeriodReportActivityRow {
  name: string;
  phase: string | null;
  trade: string | null;
  hours: string;
  status: string;
  percentComplete: number;
}

export interface PeriodReportDocxData {
  companyName: string;
  projectName: string;
  projectAddress?: string | null;
  periodTypeLabel: string;
  rangeLabel: string;
  generatedAtLabel: string;
  overallProgressPercent: number;
  kpis: PeriodReportKpi[];
  weatherBreakdown: PeriodReportKpi[];
  activities: PeriodReportActivityRow[];
}

const INK = "101828";
const BODY = "475467";
const MUTED = "98A2B3";
const HAIRLINE = "EAECF0";
const PANEL = "F9FAFB";

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const hairlineBorders = {
  top: { style: BorderStyle.SINGLE, size: 2, color: HAIRLINE },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: HAIRLINE },
  left: { style: BorderStyle.SINGLE, size: 2, color: HAIRLINE },
  right: { style: BorderStyle.SINGLE, size: 2, color: HAIRLINE },
};

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, color: INK, size: 24 })],
  });
}

function metaCell(label: string, value: string): TableCell {
  return new TableCell({
    borders: noBorders,
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: label.toUpperCase(), size: 16, color: MUTED, bold: true })],
      }),
      new Paragraph({
        children: [new TextRun({ text: value, size: 22, color: INK })],
      }),
    ],
  });
}

function kpiTable(rows: PeriodReportKpi[]): Table {
  const pairs: PeriodReportKpi[][] = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: pairs.map(
      (pair) =>
        new TableRow({
          children: [
            metaCell(pair[0]!.label, pair[0]!.value),
            pair[1]
              ? metaCell(pair[1].label, pair[1].value)
              : new TableCell({ borders: noBorders, children: [] }),
          ],
        }),
    ),
  });
}

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: hairlineBorders,
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: PANEL, color: "auto" },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 16, color: MUTED })],
      }),
    ],
  });
}

function bodyCell(
  text: string,
  width: number,
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType],
): TableCell {
  return new TableCell({
    borders: hairlineBorders,
    width: { size: width, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        alignment,
        children: [new TextRun({ text, size: 18, color: BODY })],
      }),
    ],
  });
}

function activitiesTable(rows: PeriodReportActivityRow[]): Table {
  const widths = [30, 18, 16, 12, 14, 10];
  const header = new TableRow({
    tableHeader: true,
    children: [
      headerCell("Activity", widths[0]!),
      headerCell("Phase", widths[1]!),
      headerCell("Trade", widths[2]!),
      headerCell("Hours", widths[3]!),
      headerCell("Status", widths[4]!),
      headerCell("% Complete", widths[5]!),
    ],
  });
  const body = rows.map(
    (row) =>
      new TableRow({
        children: [
          bodyCell(row.name, widths[0]!),
          bodyCell(row.phase ?? "—", widths[1]!),
          bodyCell(row.trade ?? "—", widths[2]!),
          bodyCell(row.hours, widths[3]!, AlignmentType.RIGHT),
          bodyCell(row.status, widths[4]!),
          bodyCell(`${Math.round(row.percentComplete)}%`, widths[5]!, AlignmentType.RIGHT),
        ],
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

export async function renderPeriodReportDocx(data: PeriodReportDocxData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: data.companyName, size: 18, color: MUTED, bold: true })],
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { before: 80, after: 40 },
      children: [
        new TextRun({
          text: `${data.projectName} — ${data.periodTypeLabel} Report`,
          bold: true,
          size: 32,
          color: INK,
        }),
      ],
    }),
  ];

  if (data.projectAddress) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: data.projectAddress, size: 18, color: BODY })],
      }),
    );
  }

  children.push(
    kpiTable([
      { label: "Reporting period", value: data.rangeLabel },
      { label: "Generated", value: data.generatedAtLabel },
      { label: "Overall project completion", value: `${Math.round(data.overallProgressPercent)}%` },
    ]),
  );

  children.push(heading("Summary"));
  children.push(kpiTable(data.kpis));

  if (data.weatherBreakdown.length > 0) {
    children.push(heading("Weather"));
    children.push(kpiTable(data.weatherBreakdown));
  }

  children.push(heading("Activity"));
  children.push(
    data.activities.length > 0
      ? activitiesTable(data.activities)
      : new Paragraph({
          children: [
            new TextRun({ text: "No activities were logged in this period.", size: 18, color: MUTED }),
          ],
        }),
  );

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
