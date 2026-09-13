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
    <div
      className={cn(
        "site-container",
        className,
      )}
    >
      {children}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
  ink: "bg-ink text-white hover:bg-ink/90",
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

/**
 * Large and light, left by default, with the label above it — the reference's
 * hierarchy. Bold-and-small was making every section shout at the same volume.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        align === "center" ? "items-center text-center" : "items-start text-left",
      )}
    >
      {eyebrow ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </span>
      ) : null}
      <div
        className={cn(
          "flex w-full flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-12",
          align === "center" && "sm:flex-col sm:items-center",
        )}
      >
        <h2 className="display max-w-2xl text-4xl text-ink sm:text-5xl lg:text-6xl 2xl:max-w-3xl 2xl:text-7xl">
          {title}
        </h2>
        {action ? <div className="flex-shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="max-w-xl text-pretty text-base leading-relaxed text-muted 2xl:text-lg">
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
