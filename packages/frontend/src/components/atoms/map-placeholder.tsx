import { cn } from "@/lib/utils";

interface MapPlaceholderProps {
  className?: string;
}

function MapPlaceholder({ className }: MapPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex h-[200px] items-center justify-center rounded-xl bg-[#F6F6F6]",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2 text-gray-400">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-6"
          aria-hidden="true"
        >
          <path
            d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="10"
            r="3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-sm font-medium">Verify on map</span>
      </div>
    </div>
  );
}

MapPlaceholder.displayName = "MapPlaceholder";

export { MapPlaceholder, type MapPlaceholderProps };
