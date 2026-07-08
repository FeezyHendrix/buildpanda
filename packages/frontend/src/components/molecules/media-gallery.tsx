import { useState } from "react";
import { cn } from "@/lib/utils";
import { PlayIcon } from "@/components/atoms/project-nav-icons";
import { MediaLightbox } from "@/components/molecules/media-lightbox";
import type { MediaItem } from "@/lib/project-types";

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
  eagerFirst = true,
  className,
}: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 no-scrollbar",
          className,
        )}
      >
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightboxIndex(idx)}
            aria-label={item.type === "video" ? "Play video" : "View image"}
            className={cn(
              "group relative overflow-hidden rounded-[4px] bg-[#F6F6F6] w-[215.33px] shrink-0 snap-start outline-none",
              ASPECT[aspectRatio],
            )}
          >
            <img
              src={item.url}
              alt=""
              className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading={eagerFirst && idx === 0 ? "eager" : "lazy"}
            />
            {item.type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex size-10 items-center justify-center rounded-full bg-white/95 text-[#004DE7]">
                  <PlayIcon className="size-5" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <MediaLightbox
        items={items}
        index={lightboxIndex}
        onOpenChange={(open) => {
          if (!open) setLightboxIndex(null);
        }}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}

MediaGallery.displayName = "MediaGallery";

export { MediaGallery, type MediaGalleryProps };
