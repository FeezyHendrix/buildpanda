import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconBoxTone =
  | "brand"
  | "orange"
  | "green"
  | "purple"
  | "amber"
  | "red"
  | "gray";

type IconBoxSize = "sm" | "md" | "lg";

interface IconBoxProps extends HTMLAttributes<HTMLDivElement> {
  tone?: IconBoxTone;
  size?: IconBoxSize;
  icon: ReactNode;
}

const toneStyles: Record<IconBoxTone, string> = {
  brand: "bg-[#E6EFFE] text-[#004DE7]",
  orange: "bg-[#FFEFD9] text-[#D8741F]",
  green: "bg-[#E8F7EE] text-[#1B8E45]",
  purple: "bg-[#EDE7FF] text-[#5A3DD0]",
  amber: "bg-[#FFF3E0] text-[#C26A00]",
  red: "bg-[#FDECEC] text-[#C72525]",
  gray: "bg-[#F6F6F6] text-gray-700",
};

const sizeStyles: Record<IconBoxSize, string> = {
  sm: "size-9 rounded-lg [&_svg]:size-4 [&_img]:size-4",
  md: "size-11 rounded-xl [&_svg]:size-5 [&_img]:size-5",
  lg: "size-14 rounded-2xl [&_svg]:size-6 [&_img]:size-6",
};

const IconBox = forwardRef<HTMLDivElement, IconBoxProps>(
  ({ tone = "brand", size = "md", icon, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        toneStyles[tone],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {icon}
    </div>
  ),
);

IconBox.displayName = "IconBox";

export { IconBox, type IconBoxProps, type IconBoxTone };
