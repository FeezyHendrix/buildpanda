import Image, { getImageProps } from "next/image";
import { hero } from "@/content/hero";

const { frame } = hero;

// Both desktop halves share one width rule so they meet edge to edge.
const SIZES =
  "(min-width: 1384px) 1320px, (min-width: 768px) calc(100vw - 4rem), calc(100vw - 2.5rem)";
// From this width up the frame is the two-part desktop artwork; below it, one cropped image.
const DESKTOP_QUERY = "(min-width: 640px)";

/**
 * Top of the product browser frame, flush on the hero's bottom edge. On small
 * screens it is a single crop that runs off the right edge of the viewport.
 */
export function HeroFrameTop() {
  const desktop = getImageProps({
    src: frame.top.src,
    alt: frame.top.alt,
    width: frame.width,
    height: frame.top.height,
    sizes: SIZES,
  }).props;
  const mobile = getImageProps({
    src: frame.mobile.src,
    alt: frame.top.alt,
    width: frame.mobile.width,
    height: frame.mobile.height,
    sizes: "100vw",
    priority: true,
  }).props;

  return (
    <div className="relative -mr-5 sm:mr-0">
      {/* One <img>, so only the artwork for the current breakpoint is downloaded. */}
      <picture className="relative block">
        <source
          media={DESKTOP_QUERY}
          srcSet={desktop.srcSet}
          sizes={desktop.sizes}
          width={desktop.width}
          height={desktop.height}
        />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- props come from getImageProps, alt included */}
        <img {...mobile} className="block h-auto w-full" />
      </picture>
    </div>
  );
}

/** The rest of the desktop frame. Goes flush at the top of the section after the hero. */
export function HeroFrameContinuation() {
  return (
    <div className="site-container hidden sm:block">
      {/* As in the design, the mock dissolves into the page instead of ending on its bottom edge. */}
      <div className="hero-frame-fade relative">
        <Image
          src={frame.bottom.src}
          alt=""
          width={frame.width}
          height={frame.bottom.height}
          sizes={SIZES}
          className="block h-auto w-full"
        />
      </div>
    </div>
  );
}
