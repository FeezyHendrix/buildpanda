import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
export type TextTone = 'default' | 'secondary' | 'muted' | 'brand' | 'danger' | 'inverse';
export type TextProps = HTMLAttributes<HTMLSpanElement> & {
    weight?: TextWeight;
    tone?: TextTone;
    variant?: 'body' | 'heading';
    numberOfLines?: number;
    selectable?: boolean;
};
const weights = { regular: 'font-inter', medium: 'font-inter-medium', semibold: 'font-inter-semibold', bold: 'font-inter-bold', extrabold: 'font-inter-extrabold' };
const tones = { default: 'text-ink', secondary: 'text-ink-muted', muted: 'text-ink-muted', brand: 'text-primary-500', danger: 'text-error-600', inverse: 'text-white' };
export function Text({ weight = 'regular', tone = 'default', variant = 'body', numberOfLines, selectable, className, style, ...props }: TextProps) { return <span {...props} role={variant === 'heading' ? 'heading' : props.role} aria-level={variant === 'heading' ? 2 : undefined} className={cn(variant === 'heading' ? (weight==='bold'||weight==='extrabold'?'font-heading-bold':'font-heading-semibold') : weights[weight], tones[tone], className)} style={{ ...(numberOfLines ? { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: numberOfLines, WebkitBoxOrient: 'vertical' } : {}), ...style }}/>; }
