// Generated from packages/shared/utils.ts. Edit that file, then run `pnpm sync:shared`.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
