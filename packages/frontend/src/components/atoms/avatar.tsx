import { forwardRef, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "size"> {
  name: string;
  src?: string | null;
  size?: AvatarSize;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]![0]?.toUpperCase() ?? "";
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, src, size = "md", className, ...props }, ref) => {
    const [imgFailed, setImgFailed] = useState(false);
    const showImage = src && !imgFailed;

    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#004DE7] font-semibold text-white select-none",
          sizeStyles[size],
          className,
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={name}
            className="size-full object-cover"
            onError={() => setImgFailed(true)}
            {...props}
          />
        ) : (
          <span aria-hidden="true">{getInitials(name)}</span>
        )}
      </div>
    );
  },
);

Avatar.displayName = "Avatar";

export { Avatar, type AvatarProps };
