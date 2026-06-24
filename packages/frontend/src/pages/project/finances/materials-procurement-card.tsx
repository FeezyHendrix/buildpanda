import { Link } from "react-router-dom";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Card } from "@/components/atoms/card";
import { Avatar } from "@/components/atoms/avatar";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MaterialProcurement, ProjectFinances as ProjectFinancesData } from "@/lib/project-types";

const MATERIALS_PREVIEW_LIMIT = 5;

export interface MaterialsProcurementCardProps {
  projectId: string;
  materials: MaterialProcurement[];
  currency: ProjectFinancesData["currency"];
  className?: string;
}

export function MaterialsProcurementCard({
  className,
  projectId,
  materials,
  currency,
}: MaterialsProcurementCardProps) {
  const preview = materials.slice(0, MATERIALS_PREVIEW_LIMIT);
  return (
    <Card className={`${className}`}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.chart} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Materials Procurement
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/materials`}
          className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
        >
          View More
        </Link>
      </div>
      <div className="bg-white rounded-[12px] h-full m-1 px-6">
        <ul className="flex flex-col">
          {preview.map((material, idx) => (
            <MaterialRow
              key={`${material.id}-${idx}`}
              material={material}
              currency={currency}
            />
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function MaterialRow({
  material,
  currency,
}: {
  material: MaterialProcurement;
  currency: ProjectFinancesData["currency"];
}) {
  return (
    <li className="flex gap-3 items-center justify-between border-b border-[#F0F0F0] py-3 last:border-b-0">
      <div className='flex gap-2 items-center'>
        <Avatar
          name={material.name}
          src={''}
          size="md"
          className={cn("h-[62px] w-[62px] rounded-[4px]")}
        />
        <div className="flex flex-col gap-1">
          <p className="truncate text-[13px] font-medium text-black-500">
            {material.name}
          </p>
          <p className="text-[11px] text-black-300">
            {material.purchasedAt} ·{" "}
          </p>
          <div className='flex gap-1 items-center'>
            <ReactSVG src={icons.paperclip} className='mt-1' />
            <a className="text-[#004DE7] hover:underline text-[13px]" href="#">
              {material.receipt}
            </a>
          </div>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
        {formatCurrency(material.amount, currency)}
      </p>
    </li>
  );
}

