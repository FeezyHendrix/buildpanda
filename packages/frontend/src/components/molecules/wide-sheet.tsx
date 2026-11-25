/**
 * Chrome shared by the wide right-hand sheets (purchase orders, change orders):
 * a 20px title, a grey one-line description, an optional hairline under the
 * header, a 24px rhythm between fields and an outlined Cancel beside the primary
 * button. The width is the caller's (1026px for a PO, 698px for a change order).
 */
export const WIDE_SHEET = {
  titleClassName: "text-[20px] leading-[28px] tracking-normal",
  descriptionClassName: "mt-[4px] text-[14px] font-normal leading-[20px] text-[#737373]",
  bodyClassName: "gap-[24px] px-[24px] py-0",
  footerClassName:
    "gap-[4px] px-[24px] pb-[24px] pt-[24px] [&>button]:w-[165px] [&>button]:whitespace-nowrap [&>button]:px-[16px] [&>button:first-child]:border [&>button:first-child]:border-[#E0E0E0] [&>button:first-child]:bg-white [&>button:first-child]:hover:bg-[#F6F6F6]",
} as const;

export const SHEET_HEADER_RULED = "px-[24px] pb-[23px] pt-[40px]";
export const SHEET_HEADER_PLAIN = "px-[24px] pb-[24px] pt-[40px]";

/** The hairline under a ruled header; it pulls up 1px so the next block keeps the design's 24px. */
export function SheetRule() {
  return <div aria-hidden className="-mb-[1px] h-px shrink-0 bg-[#EEEEEE]" />;
}
