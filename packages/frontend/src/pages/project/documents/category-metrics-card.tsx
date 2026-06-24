import { ReactSVG } from "react-svg";
import { Card } from "@/components/atoms/card";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";
import type { DocumentCategory } from "@/lib/project-types";

// ── Stubs: fill in values per category name when ready ────────────────────
const CATEGORY_ICON_STUBS: Record<string, string> = {
  "Land Documents": icons.folderBlue,
  "Architectural Plans": icons.note,
  "Contracts & Agreements": icons.hammer,
  "Invoices & Receipts": icons.receipt,
  "Government Approvals": icons.protect,
  "Inspection Certs": icons.clipboard,
};

const CATEGORY_BG: Record<string, string> = {
  "Land Documents": "bg-primary-50",
  "Architectural Plans": "bg-[#E0FFFC]",
  "Contracts & Agreements": "bg-[#FFF3DE]",
  "Invoices & Receipts": "bg-[#EDE2FF]",
  "Government Approvals": "bg-[#FFE6F0]",
  "Inspection Certs": "bg-[#DEEAFF]",
};

export function CategoryMetricsCard({ category }: { category: DocumentCategory }) {
  const iconSrc = CATEGORY_ICON_STUBS[category.name] ?? "";
  const bgColor = CATEGORY_BG[category.name] ?? "bg-primary-50";

  return (
    <Card padding="md" interactive>
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "flex items-center justify-center w-[38px] h-[38px] rounded-[8px] p-[10px]",
            bgColor,
          )}
        >
          <ReactSVG src={iconSrc} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {category.name}
          </p>
          <p className="mt-1 text-xs tabular-nums text-gray-500">
            {category.fileCount} Files · {category.totalSize}
          </p>
        </div>
      </div>
    </Card>
  );
}

