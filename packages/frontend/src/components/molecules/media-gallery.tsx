import { cn } from "@/lib/utils";
import { PlayIcon } from "@/components/atoms/project-nav-icons";
import type { MediaItem } from "@/lib/project-mock-data";

interface MediaGalleryProps {
  items: readonly MediaItem[];
  aspectRatio?: "square" | "video" | "4/3";
  maxColumns?: 2 | 3;
  eagerFirst?: boolean;
  className?: string;
}

const ASPECT: Record<NonNullable<MediaGalleryProps["aspectRatio"]>, string> = {
  square: "aspect-square",
  video: "aspect-video",
  "4/3": "aspect-[4/3]",
};

function MediaGallery({
  items,
  aspectRatio = "4/3",
  maxColumns = 3,
  eagerFirst = true,
  className,
}: MediaGalleryProps) {
  if (items.length === 0) return null;

  const cols =
    items.length === 1
      ? "grid-cols-1"
      : items.length === 2
        ? "grid-cols-2"
        : maxColumns === 2
          ? "grid-cols-2"
          : "grid-cols-3";

  return (
    <div className={cn("grid gap-2", cols, className)}>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className={cn(
            "relative overflow-hidden rounded-xl bg-[#F6F6F6]",
            ASPECT[aspectRatio],
          )}
        >
          <img
            src={item.url}
            alt=""
            className="size-full object-cover"
            loading={eagerFirst && idx === 0 ? "eager" : "lazy"}
          />
          {item.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/95 text-[#004DE7]">
                <PlayIcon className="size-5" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

MediaGallery.displayName = "MediaGallery";

export { MediaGallery, type MediaGalleryProps };
