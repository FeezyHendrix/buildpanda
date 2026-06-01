import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn, initials } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
  secondary: "bg-surface-muted text-ink hover:bg-[#ececec] border border-line",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface-muted",
  danger: "bg-danger-soft text-danger hover:bg-[#fbdcdc] border border-[#f6cccc]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-lg font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-white", className)} {...props}>
      {children}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin text-brand", className)}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner /> {label}…
    </div>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";
const toneStyles: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  "On Track": "success",
  Completed: "success",
  Approved: "success",
  Verified: "success",
  "At Risk": "warning",
  Pending: "warning",
  InProgress: "brand",
  "In Progress": "brand",
  Open: "brand",
  Delayed: "danger",
  "Action Required": "danger",
  Escalated: "danger",
  Expired: "danger",
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted">—</span>;
  return <Badge tone={statusTone[value] ?? "neutral"}>{value}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={role === "admin" ? "brand" : "neutral"}>{role}</Badge>;
}

export function Avatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    return <img src={image} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-line bg-surface-faint py-14 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-[#f6cccc] bg-danger-soft px-4 py-3 text-sm text-danger">
      {message ?? "Something went wrong. Please try again."}
    </div>
  );
}
