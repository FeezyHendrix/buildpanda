import { type ReactNode } from "react";
import { Card, type CardPadding } from "@/components/atoms/card";
import { cn } from "@/lib/utils";
import { ReactSVG } from "react-svg";
import { Badge, ProgressBar } from "../atoms";
import { icons } from "@/assets/icons/icons";

interface KpiCardProps {
  padding?: CardPadding;
  className?: string;
  title?: string;
  label?: string;
  value?: string | number;
  subValue?: string;
  icon?: string;
  progress?: number;
  required?: boolean;
  /** Show the subValue with a warning icon (e.g. a count that needs attention). */
  warn?: boolean;
  children?: ReactNode;
  stages?: boolean;
  complete?: number;
  total?: number;
}

function KpiCard({
  padding = "md",
  className,
  title,
  label,
  value,
  subValue,
  icon,
  progress,
  required,
  warn,
  children,
  stages = false,
  complete = 0,
  total,
}: KpiCardProps) {
  const heading = title ?? label;
  return (
    <Card padding={padding} className={cn(
        "flex flex-col gap-4 bg-[#F8F8F8] p-5 flex-1 min-w-0 min-h-[112px] rounded-[1px] border-none",
        className
      )}>
      {/* Icon + title */}
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-2")}>
          {icon && <ReactSVG src={icon} />}
          {heading && (
            <p className="text-[12px] text-black-300 font-medium">{heading}</p>
          )}
        </div>
      </div>

      {children}

      {value !== undefined && value !== null && value !== "" && (
        <div className='flex flex-col gap-2'>
          <p className="text-[20px] font-semibold text-black-500 leading-tight [overflow-wrap:anywhere]">{value}</p>
          {subValue && (
            <div>
              {warn ? (
                <div className='flex gap-2 items-center'>
                  <ReactSVG src={icons.warningCircle} />
                  <p className="text-[13px] text-black-300 font-medium">{subValue}</p>
                </div>
              ) : (
                <p className="text-[13px] text-black-300 font-medium">{subValue}</p>
              )}
            </div>
          )}
          {required && (
            <div className='bg-primary rounded-[16px] py-1 px-1 flex justify-between'>
              <div className='flex gap-1 items-center'>
                <ReactSVG src={icons.infoCircle} />
                <p className='text-[12px] text-white'>Requires attention</p>
              </div>
              <button
                type="button"
                className="text-xs font-medium bg-white text-primary text-[11px] -my-[0.9px] -mx-[0.9px] px-1 rounded-[100px] cursor-pointer"
              >
                Open
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress bar (optional) */}
      {progress !== undefined && (
        <div className='flex flex-col gap-2'>
          <div className="flex justify-between items-center">
            <p className='text-[25px] text-black-500 font-bold'>{progress}%</p>
            {stages ? (
              <p className="mt-1 text-[12px] text-black-300">
                {complete} of {total} stages complete
              </p>
            ) : (
              <Badge tone='success' className={cn("py-[2px] px-[8px] rounded-[12px] bg-success-500 text-[11px] hover:bg-success-500 text-white")}>On Track</Badge>
            )}
          </div>

          <ProgressBar tone='success' value={progress} className={cn("bg-success-100 h-1.5")} />
        </div>
      )}
    </Card>
  );
}

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps };
