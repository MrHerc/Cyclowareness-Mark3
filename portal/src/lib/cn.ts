import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge needs to know our custom scales, otherwise `text-caption` would be merged away as a colour. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["tab-sm", "tab", "caption", "body-sm", "body", "lead", "title-sm", "title", "headline", "display", "numeral"],
      radius: ["xs", "sm", "md", "lg", "xl", "2xl", "pill"],
      shadow: ["xs", "raised", "overlay", "bar"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
