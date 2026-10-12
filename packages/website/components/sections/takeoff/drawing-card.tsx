import Image from "next/image";
import type { CSSProperties } from "react";
import { takeoff } from "@/content/takeoff";

/**
 * The uploaded drawing: a file title bar over the plan. Each loop, a scan line
 * sweeps down the drawing, then callouts pop up where Panda AI has found a
 * wall, a window and a door (see `.scan` and `.callout` in globals.css).
 */
export function DrawingCard() {
  const { filename, image, callouts } = takeoff.drawing;

  return (
    <figure>
      <figcaption className="flex h-10 items-center bg-white/16 px-4 text-[0.8125rem]">{filename}</figcaption>
      <div className="relative flex aspect-[5/4] items-center overflow-hidden bg-white p-2">
        {/* Sized to the image, so callout positions are percentages of the plan itself. */}
        <div className="relative w-full" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 1024px) 40vw, calc(100vw - 2.5rem)"
            className="absolute inset-0 size-full"
          />
          {callouts.map((callout) => (
            <span
              key={callout.id}
              aria-hidden="true"
              style={{ left: `${callout.x}%`, top: `${callout.y}%` } as CSSProperties}
              className={`callout callout-${callout.id} callout-step-${callout.step}`}
            >
              <span className="callout-label">{callout.label}</span>
              <span className="callout-dot" />
            </span>
          ))}
        </div>

        {/* The read: a line sweeps down the drawing, then the sheet settles to a grey tint. */}
        <span aria-hidden="true" className="scan">
          <span className="scan-wash" />
          <span className="scan-tint" />
        </span>
      </div>
    </figure>
  );
}
