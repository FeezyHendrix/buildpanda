import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The design system's type scale (`text-h1`…`text-caption-s` in styles/index.css)
 * is made of font sizes. Without telling tailwind-merge so, it reads them as
 * colours and drops them whenever a real text colour follows, so
 * `text-caption-m text-gray-500` lost its size.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["h1", "h2", "h3", "h4", "h5", "h6", "body-l", "body-m", "body-s", "caption-l", "caption-m", "caption-s"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
