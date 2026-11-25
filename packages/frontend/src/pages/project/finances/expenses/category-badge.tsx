const FALLBACK_COLOR = "#6B7280";

/**
 * A category as a pill: its own colour for the border and a faint wash, with
 * the text pulled darker so a bright preset (green, yellow) still reads on it.
 */
export function CategoryBadge({ categoryLabel, categoryColor }: { categoryLabel: string; categoryColor: string | null }) {
  const hex = categoryColor || FALLBACK_COLOR;
  return (
    <span
      className="inline-flex h-[24px] items-center whitespace-nowrap rounded-full border px-[8px] text-caption-m font-medium"
      style={{
        borderColor: `${hex}4D`,
        backgroundColor: `${hex}14`,
        color: `color-mix(in srgb, ${hex} 88%, black)`,
      }}
    >
      {categoryLabel}
    </span>
  );
}

CategoryBadge.displayName = "CategoryBadge";
