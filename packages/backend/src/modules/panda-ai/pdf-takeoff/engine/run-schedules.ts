// Two phases of the automated take-off, lifted out whole.
//
// Split from `run.ts` at the house 400-line ceiling. `generateForSession` is one
// long sequence by nature — read, measure, dedupe, schedule, classify, build up,
// price — and these are the two steps of it that touch nothing else in the run:
// collapsing the same item measured on several sheets into one line, and letting
// the architect's door/window schedule correct the tag census. Both are moved
// verbatim; neither changes what the run produces.

import {
  applyOpeningDeductions,
  applySchedules,
  measureDiagramSizes,
  mergeDiagramSizes,
  readSchedules,
} from "./schedule.ts";
import { bbsToItems, pileScheduleToItems, provisionalRebarItem, readBbs, readPileSchedule } from "./structural-schedule.ts";
import { chatLongJsonValidated } from "../../../../lib/llm-long-text.ts";
import { isLlmConfigured } from "../../../../lib/llm.ts";
import type { MeasuredBoqItem, TextRun } from "../types.ts";
import type { ProgressFn } from "./run.ts";

/**
 * The same item measured on several sheets, as one line with the quantities
 * summed. Separate floors genuinely add up; two views of ONE floor are avoided
 * upstream by measuring a single region per sheet, so anything summed here is
 * flagged low-confidence for a per-sheet review rather than trusted silently.
 */
export function mergeAcrossSheets(dedupedItems: MeasuredBoqItem[]): Map<string, MeasuredBoqItem> {
  const merged = new Map<string, MeasuredBoqItem>();
  for (const item of dedupedItems) {
    const key = `${item.code}|${item.description}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, mergedPages: [item.pageNumber] } as MeasuredBoqItem & { mergedPages: number[] });
    } else {
      existing.qtyGross = Math.round((existing.qtyGross + item.qtyGross) * 100) / 100;
      existing.qty = Math.round((existing.qty + item.qty) * 100) / 100;
      (existing as MeasuredBoqItem & { mergedPages: number[] }).mergedPages.push(item.pageNumber);
      existing.geometries.push(...item.geometries.map((g) => ({ ...g, pageNumber: g.pageNumber ?? item.pageNumber })));
      if (item.confidence === "low") existing.confidence = "low";
    }
  }
  for (const item of merged.values()) {
    const pages = (item as MeasuredBoqItem & { mergedPages: number[] }).mergedPages;
    if (pages.length > 1) {
      item.measurementBasis = `${item.measurementBasis.split(" (")[0]} — summed across ${pages.length} sheets (pages ${pages.join(", ")}); repeated floor views may double-count, review per sheet`;
      item.confidence = "low";
      item.confidenceReason = "two sheets summed";
    }
  }
  return merged;
}

export interface SchedulePass {
  billItems: MeasuredBoqItem[];
  areasOnly: boolean;
  scheduleSheets: { pageNumber: number; lines: string[] }[];
  scheduleTexts: TextRun[];
  progress: ProgressFn;
}

/**
 * The schedule sheets, applied. The architect's door/window table is the
 * authoritative count and carries sizes and materials; the tag census measured
 * off the plans becomes the cross-check, and disagreements are flagged rather
 * than reconciled. Bar-bending and pile schedules add their own items.
 */
export async function applyScheduleSheets(
  pass: SchedulePass,
): Promise<{ billItems: MeasuredBoqItem[]; summary: string }> {
  const { areasOnly, scheduleSheets, scheduleTexts, progress } = pass;
  let billItems = pass.billItems;
  for (const sheet of areasOnly ? [] : scheduleSheets) {
    const reading = readBbs(sheet.lines);
    if (reading) {
      if (reading.unreadable) {
        billItems.push(provisionalRebarItem(sheet.pageNumber));
        await progress("schedules", `Bar bending schedule on page ${sheet.pageNumber} could not be read reliably — rebar left provisional`);
      } else {
        const rebarItems = bbsToItems(reading, sheet.pageNumber);
        if (rebarItems.length > 0) {
          billItems.push(...rebarItems);
          await progress("schedules", `Read bar bending schedule on page ${sheet.pageNumber}: ${reading.totalTonnes.toFixed(2)} t reinforcement`);
        }
      }
    }
    const piles = readPileSchedule(sheet.lines);
    if (piles) {
      const pileItems = pileScheduleToItems(piles, sheet.pageNumber);
      if (pileItems.length > 0) {
        billItems.push(...pileItems);
        const totalPiles = Object.values(piles.byDiameter).reduce((s, d) => s + d.number, 0);
        await progress("schedules", `Read pile schedule on page ${sheet.pageNumber}: ${totalPiles} piles`);
      }
    }
  }

  let scheduleSummary = "";
  if (!areasOnly && isLlmConfigured() && scheduleSheets.length > 0) {
    await progress("schedules", `Reading ${scheduleSheets.length} schedule sheet(s)`);
    try {
      let schedules = await readSchedules(scheduleSheets, async (messages, schema) =>
        chatLongJsonValidated(messages, schema),
      );
      if (schedules) {
        // deterministic diagram dimensions beat transcribed table cells
        const diagramSizes = measureDiagramSizes(scheduleTexts);
        if (diagramSizes.size > 0) {
          schedules = mergeDiagramSizes(schedules, diagramSizes);
          await progress("schedules", `Measured ${diagramSizes.size} type elevations on the schedule sheet`);
        }
        billItems = applySchedules(billItems, schedules);
        billItems = applyOpeningDeductions(billItems, schedules);
        const specs = [...schedules.windows, ...schedules.doors]
          .filter((e) => e.material || e.remarks)
          .map((e) => `${e.type}: ${[e.material, e.remarks].filter(Boolean).join(", ")}`)
          .slice(0, 20);
        scheduleSummary = specs.length > 0 ? ` Schedule specs: ${specs.join("; ")}.` : "";
        await progress("schedules", `Applied schedules: ${schedules.windows.length} window types, ${schedules.doors.length} door types`);
      }
    } catch {
      await progress("schedules", "Schedule sheets found but could not be read; tag census stands");
    }
  }
  return { billItems, summary: scheduleSummary };
}
