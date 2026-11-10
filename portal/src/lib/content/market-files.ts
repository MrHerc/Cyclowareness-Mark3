/**
 * The market packs on disk (content/market): read by the lesson checker, apply-market and the library
 * import, which all compare a market translation with its English source through the same address map.
 */
import fs from "node:fs";
import path from "node:path";
import { azWorldSchema, marketPackSchema, marketSource, type AzWorld, type MarketPack } from "./market";

export type Market = { world: AzWorld; packs: MarketPack[] };

let cached: Market | undefined;

/** az-world.json and every pack (skeletons included), validated; read once per process. */
export function readMarket(): Market {
  if (cached) return cached;
  const dir = path.join(process.cwd(), "content", "market");
  const read = (f: string): unknown => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const packs = fs
    .readdirSync(dir)
    .filter((f) => /^[a-z]{2}\.json$/.test(f))
    .map((f) => marketPackSchema.parse(read(f)));
  cached = { world: azWorldSchema.parse(read("az-world.json")), packs };
  return cached;
}

/** The ready pack of a language, if it has one. */
export function readyPack(locale: string, market = readMarket()): MarketPack | undefined {
  return market.packs.find((p) => p.lang === locale && p.status === "ready");
}

/** What a translation's parity is checked against: the English lesson, through its market's address map when the language has a ready pack. */
export function parityEnglish(en: unknown, locale: string, seed: string, market = readMarket()): unknown {
  const pack = readyPack(locale, market);
  return pack ? marketSource(en, seed, pack, market.world) : en;
}
