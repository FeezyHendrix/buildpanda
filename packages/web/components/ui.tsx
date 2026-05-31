import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

function cn(...parts: Array<string | false | null | undefined>) {
  return twMerge(parts.filter(Boolean).join(" "));
}

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
  secondary:
    "bg-surface-muted text-ink hover:bg-[#ececec] active:bg-[#e2e2e2] border border-line",
  outline:
    "bg-white text-ink border border-line hover:border-brand hover:text-brand",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface-muted",
  white: "bg-white text-brand hover:bg-white/90 active:bg-white/80",
};

const buttonSizes = {
  md: "h-[50px] px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

type ButtonLinkProps = {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
} & ComponentProps<typeof Link>;

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-faint px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
      )}
    >
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="max-w-2xl text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-pretty text-base leading-relaxed text-muted sm:text-lg",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-[0_8px_30px_rgba(13,19,33,0.06)]">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}
