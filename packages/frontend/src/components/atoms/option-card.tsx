import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import CardBg from '@/assets/images/card-bg.png';

export interface OptionCardBadge {
  label: string;
  tone?: BadgeTone;
}

interface OptionCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  selected?: boolean;
  disabled?: boolean;
  /** Legacy: single badge rendered top-right (absolute). */
  badge?: string;
  /** New: multiple badges rendered at card bottom. */
  badges?: OptionCardBadge[];
  onClick?: () => void;
  className?: string;
}

function OptionCard({
  icon,
  title,
  subtitle,
  selected = false,
  disabled = false,
  badge,
  badges,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex flex-1 flex-col items-start gap-3 p-6 text-left bg-cover bg-center bg-no-repeat",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/20",
        "transition-colors",
        selected
          ? "border-2 border-[#004DE7] bg-white"
          : "border border-[#EBEBEB] bg-white hover:border-[#CCCCCC]",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
      style={{ backgroundImage: selected ? `url(${CardBg})` : undefined }}
    >
      {badge && (
        <Badge tone={badges?.[0]?.tone} variant="soft" size="md" className="absolute right-4 top-4 bg-[#E8FCF4] px-2 py-1 text-xs font-semibold text-[#12A368]">
          {badge}
        </Badge>
      )}

      <div
        className={cn(
          "flex items-center justify-center [&_svg]:size-6",
          selected ? "[&_path]:fill-white" : "[&_path]:fill-black",
        )}
      >
        {icon}
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "text-caption-l font-semibold",
            selected ? "text-white" : "text-black",
          )}
        >
          {title}
        </span>
        <span className={cn("text-caption-m!", selected ? "text-white" : "text-grey-450")}>{subtitle}</span>
      </div>

      {badges && badges.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {badges.map((b) => (
            <Badge key={b.label} tone={b.tone ?? "neutral"} variant="soft" size="sm">
              {b.label}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

OptionCard.displayName = "OptionCard";

export { OptionCard, type OptionCardProps };
