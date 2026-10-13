import { MapPin } from "lucide-react";
import Image from "next/image";
import { StatusPill } from "@/components/ui/status-pill";
import { siteSection } from "@/content/site-section";

/** A progress update as it appears in the product: the site photo, where and when, and who posted it. */
export function PhotoCard() {
  const { photo } = siteSection;

  return (
    <article className="border border-line bg-white">
      <div className="relative">
        <Image
          src={photo.image.src}
          alt={photo.image.alt}
          width={photo.image.width}
          height={photo.image.height}
          sizes="(min-width: 1024px) 45vw, calc(100vw - 2.5rem)"
          className="block h-auto w-full"
        />
        <p className="absolute top-3 left-3 flex items-center gap-1.5 bg-ink/85 px-2 py-1 text-[0.6875rem] text-white">
          <MapPin aria-hidden="true" strokeWidth={1.75} className="size-3" />
          {photo.location}
        </p>
        <p className="absolute right-3 bottom-3 bg-white px-2 py-2 text-[0.6875rem] leading-none tabular-nums">
          {photo.meta}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="text-[0.8125rem] font-semibold">{photo.title}</h3>
          <p className="mt-0.5 text-[0.6875rem] text-ink-soft">{photo.byline}</p>
        </div>
        <StatusPill tone="success">{photo.status}</StatusPill>
      </div>
    </article>
  );
}
