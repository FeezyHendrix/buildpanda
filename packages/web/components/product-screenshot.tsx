import Image from "next/image";

interface ProductScreenshotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  description: string;
}

export function ProductScreenshot({
  src,
  alt,
  width,
  height,
  title,
  description,
}: ProductScreenshotProps) {
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        aria-label={`View full-size screenshot: ${title} (opens in a new tab)`}
        className="block border-b border-line"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 1023px) calc(100vw - 48px), (max-width: 1535px) 520px, (max-width: 1799px) 640px, (max-width: 2599px) 760px, 940px"
          className="block w-full bg-surface-faint"
        />
      </a>
      <figcaption className="flex flex-col gap-2 p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="text-sm leading-relaxed text-muted">{description}</p>
      </figcaption>
    </figure>
  );
}
