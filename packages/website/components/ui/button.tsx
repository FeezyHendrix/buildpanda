import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type ButtonLinkProps = ComponentProps<"a"> & { variant: "solid" | "outline" };

/**
 * A link styled as a button. Colours come from the `--surface-*` variables of
 * the section or navbar layer it sits in, so it needs no theme prop.
 */
export function ButtonLink({ variant, className, ...props }: ButtonLinkProps) {
  return <a className={cn("btn", variant === "solid" ? "btn-solid" : "btn-outline", className)} {...props} />;
}
