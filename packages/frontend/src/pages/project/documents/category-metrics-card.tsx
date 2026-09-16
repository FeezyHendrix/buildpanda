import { ReactSVG } from "react-svg";
import { documentIcons } from "@/assets/icons2/icon2";
import type { DocumentCategory } from "@/lib/project-types";

export function CategoryMetricsCard({
  category,
  index = 0,
}: {
  category: DocumentCategory;
  index?: number;
}) {
  const iconSrc = documentIcons[index % documentIcons.length] ?? documentIcons[0];

  return (
    <div className="cursor-pointer border border-[#EBEBEB] bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center">
        <ReactSVG src={iconSrc} />
      </div>
      <p className="truncate text-caption-l font-medium text-grey-800">
        {category.name}
      </p>
      <p className="mt-1 text-caption-s text-grey-450">
        {category.fileCount} {category.fileCount <= 1 ? "File" : "Files"} • {category.totalSize}
      </p>
    </div>
  );
}
