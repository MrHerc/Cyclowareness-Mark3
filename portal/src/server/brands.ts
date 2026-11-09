import fs from "node:fs";
import path from "node:path";
import type { Brand } from "../lib/content/types";

let brandCache: Record<string, Brand> | null = null;
function allBrands(): Record<string, Brand> {
  brandCache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "library", "brands.json"), "utf8")) as Record<string, Brand>;
  return brandCache;
}

/** Only the brands a lesson references are sent to the browser. */
export function brandsFor(scenes: unknown): Record<string, Brand> {
  const refs = new Set<string>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Record<string, unknown>;
    if (typeof o.brandRef === "string") refs.add(o.brandRef);
    Object.values(o).forEach(walk);
  };
  walk(scenes);
  const all = allBrands();
  return Object.fromEntries([...refs].filter((r) => all[r]).map((r) => [r, all[r]]));
}
