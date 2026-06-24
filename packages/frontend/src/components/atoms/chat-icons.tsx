import { type ReactNode, type SVGAttributes } from "react";
import { cn } from "@/lib/utils";

type IconProps = SVGAttributes<SVGSVGElement>;

function IconBase({ className, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      {...props}
      className={cn("size-5", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return <IconBase {...props}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" /></IconBase>;
}

export function BellOffIcon(props: IconProps) {
  return <IconBase {...props}><path d="M13.73 21a2 2 0 0 1-3.46 0m5.18-4H5a2 2 0 0 1-2-2v-1.16a2.63 2.63 0 0 0-.73-1.84L1.83 11A6 6 0 0 1 4 5.31m11 8.52V11a6 6 0 0 0-2.28-4.5M2 2l20 20" /></IconBase>;
}

export function SearchIcon(props: IconProps) {
  return <IconBase {...props}><path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></IconBase>;
}

export function FilterIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 7h16M7 12h10M10 17h4" /></IconBase>;
}

export function InfoIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 16v-4" /><path d="M12 8h.01" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></IconBase>;
}

export function HomeIcon(props: IconProps) {
  return <IconBase {...props}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></IconBase>;
}

export function MessageSquareIcon(props: IconProps) {
  return <IconBase {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></IconBase>;
}

export function HashIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></IconBase>;
}

export function PlusIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>;
}

export function SettingsIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.6.82 1 1.55 1H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></IconBase>;
}

export function StarIcon(props: IconProps) {
  return <IconBase {...props}><path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.19L12 17.18 6.44 20.1l1.06-6.19L3 9.53l6.22-.9L12 3Z" /></IconBase>;
}

export function XIcon(props: IconProps) {
  return <IconBase {...props}><path d="M18 6 6 18M6 6l12 12" /></IconBase>;
}

export function FileTextIcon(props: IconProps) {
  return <IconBase {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></IconBase>;
}

export function ReplyIcon(props: IconProps) {
  return <IconBase {...props}><path d="m9 17-5-5 5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></IconBase>;
}

export function BoldIcon(props: IconProps) {
  return <IconBase {...props}><path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a3 3 0 0 1 0 6H7z" /></IconBase>;
}

export function ItalicIcon(props: IconProps) {
  return <IconBase {...props}><path d="M19 4h-9M14 20H5M15 4 9 20" /></IconBase>;
}

export function LinkIcon(props: IconProps) {
  return <IconBase {...props}><path d="M10 13a5 5 0 0 0 7.07 0l2-2A5 5 0 0 0 12 3.93l-1.15 1.15" /><path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.15" /></IconBase>;
}

export function ListIcon(props: IconProps) {
  return <IconBase {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></IconBase>;
}

export function CodeIcon(props: IconProps) {
  return <IconBase {...props}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></IconBase>;
}

export function PlusCircleIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 8v8M8 12h8" /></IconBase>;
}

export function SmileIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></IconBase>;
}

export function AtSignIcon(props: IconProps) {
  return <IconBase {...props}><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" /></IconBase>;
}

export function SendIcon(props: IconProps) {
  return <IconBase {...props}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></IconBase>;
}
