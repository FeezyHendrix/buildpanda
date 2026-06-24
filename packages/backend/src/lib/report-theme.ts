import PDFDocument from "pdfkit";
import {
  plusJakartaSansRegular,
  plusJakartaSansMedium,
  plusJakartaSansSemiBold,
  plusJakartaSansBold,
} from "./report-fonts.ts";

export const FONT = {
  regular: "PJS",
  medium: "PJS-Medium",
  semibold: "PJS-SemiBold",
  bold: "PJS-Bold",
} as const;

export const COLOR = {
  ink: "#101828",
  body: "#475467",
  muted: "#98A2B3",
  hairline: "#EAECF0",
  panel: "#F9FAFB",
  brand: "#004DE7",
  danger: "#D42C19",
  dangerTint: "#FEF3F2",
  success: "#067647",
} as const;

export const PAGE_MARGIN = 54;
export const RULE_GAP = 18;

export type ReportDoc = InstanceType<typeof PDFDocument>;

export function registerReportFonts(doc: ReportDoc): void {
  doc.registerFont(FONT.regular, plusJakartaSansRegular);
  doc.registerFont(FONT.medium, plusJakartaSansMedium);
  doc.registerFont(FONT.semibold, plusJakartaSansSemiBold);
  doc.registerFont(FONT.bold, plusJakartaSansBold);
}

export function reportInnerWidth(doc: ReportDoc): number {
  return doc.page.width - PAGE_MARGIN * 2;
}

export function reportBottomLimit(doc: ReportDoc): number {
  return doc.page.height - PAGE_MARGIN - 22;
}
