import { type SVGAttributes } from "react";
import { cn } from "@/lib/utils";

type IconProps = SVGAttributes<SVGSVGElement>;

export function BellIcon(props: IconProps) {
  return (
    <svg className={cn("size-5", props.className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

export function BellOffIcon(props: IconProps) {
  return (
    <svg className={cn("size-5", props.className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 01-3.46 0m5.18-4H5a2 2 0 01-2-2v-1.16a2.63 2.63 0 00-.73-1.84L1.83 11A6 6 0 014 5.31m11 8.52V11a6 6 0 00-2.28-4.5M2 2l20 20" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg className={cn("size-5", props.className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <svg className={cn("size-5", props.className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg className={cn("size-5", props.className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
