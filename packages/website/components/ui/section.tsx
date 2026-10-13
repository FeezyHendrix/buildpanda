import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import type { NavTheme } from "@/lib/themes";

const surface: Record<NavTheme, string> = {
  brand: "bg-brand text-white",
  light: "bg-cream text-ink",
  dark: "bg-dark text-white",
};

type SectionProps = ComponentProps<"section"> & { theme: NavTheme };

/**
 * A full-width page section. `theme` sets its surface and, through
 * `data-nav-theme`, the colours the navbar takes while it is over the section.
 */
export function Section({ theme, className, ...props }: SectionProps) {
  return <section data-nav-theme={theme} className={cn(surface[theme], className)} {...props} />;
}
