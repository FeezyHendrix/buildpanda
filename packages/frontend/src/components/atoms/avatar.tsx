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

/**
 * "Engr. Bolanle Adeyemi (Resident Engineer, LSMW)" is a person named Bolanle
 * Adeyemi. Taking the first and last whitespace-separated tokens gave "EL",
 * and "Femi Balogun (Surveyor)" gave "F(" (finding #15).
 */
function getInitials(name: string): string {
  const cleaned = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:mr|mrs|ms|miss|dr|engr|eng|arch|qs|sir|prof)\.?\s/gi, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
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
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-500 font-semibold text-white select-none",
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
