/**
 * Market packs: the people, places, money, phone numbers, authorities and brand analogues a language's
 * lessons use instead of the Azerbaijani world of the English source (content/market/<lang>.json).
 * scripts/apply-market.ts rewrites a market language's lesson files with applyMarket(); the lesson checker
 * fails a market language whose text still holds a token of the Azerbaijani world list
 * (content/market/az-world.json, marketTokenErrors()). Only text under the translatable keys changes and
 * every address stays (locale-parity.ts), so ids, answers and branches are untouched.
 */
import { z } from "zod";
import { APP_IDENTIFIERS, LOOKS_LIKE_ADDRESS, TRANSLATABLE, addressTokens } from "./locale-parity";
import type { Brand } from "./types";

const names = z.array(z.string().min(1));
const forms = z.record(z.string(), z.array(z.string().min(1)).min(1));

export const marketPackSchema = z
  .object({
    lang: z.string().length(2),
    /** "skeleton": the fields are empty until a native reviewer fills them; apply-market skips it. */
    status: z.enum(["ready", "skeleton"]),
    note: z.string().optional(),
    /** ISO 3166 country the pack is written for. */
    market: z.string(),
    /** "Arabic|Latin" pairs a script's spelling with the Latin one used inside passwords and network names. */
    people: z.object({ female: names, male: names, family: names }),
    cities: names,
    districts: names,
    /** `symbol` replaces the code AZN; currency words (manat) are `phrases`, since they inflect. */
    currency: z.object({ code: z.string(), symbol: z.string() }),
    /** Typical amounts per class, in the pack's currency, for authors of new market lessons and templates. */
    amounts: z.object({ salary: z.number().nonnegative(), invoice: z.number().nonnegative(), fine: z.number().nonnegative(), giftCard: z.number().nonnegative() }),
    /** Number patterns: each # takes a digit of the source number, filled from the end. */
    phone: z.object({ code: z.string(), mobile: z.string(), landline: z.string() }),
    iban: z.string(),
    government: z.object({ tax: z.string(), police: z.string(), courts: z.string(), socialInsurance: z.string() }),
    /** Keyed like az-world.json `brands`; `domain` is fictional, lesson addresses stay as they are. */
    brands: z.record(z.string(), z.object({ name: z.string().min(1), domain: z.string().min(1), description: z.string().min(1) })),
    /** Language-specific rewrites (inflected authority names, currency words, emergency numbers), whole words only. */
    phrases: z.array(z.tuple([z.string().min(1), z.string()])),
    /** Elided articles undone before a replacement that starts with a consonant (fr: d’Aysel → de Camille). */
    elisions: z.array(z.tuple([z.string().min(1), z.string().min(1)])),
  })
  .superRefine((p, ctx) => {
    if (p.status !== "ready") return;
    const required: [string, unknown][] = [
      ["market", p.market],
      ["people.female", p.people.female.length],
      ["people.male", p.people.male.length],
      ["people.family", p.people.family.length],
      ["cities", p.cities.length],
      ["districts", p.districts.length],
      ["currency.symbol", p.currency.symbol],
      ["phone.mobile", p.phone.mobile],
      ["phone.landline", p.phone.landline],
      ["iban", p.iban],
      ...Object.entries(p.government),
    ];
    for (const [key, v] of required) if (!v) ctx.addIssue({ code: "custom", path: [key], message: "required in a ready pack" });
  });
export type MarketPack = z.infer<typeof marketPackSchema>;

/** The Azerbaijani world of the source lessons: every spelling (Azerbaijani, ASCII, Arabic script) of each token. */
export const azWorldSchema = z.object({
  female: forms,
  male: forms,
  family: forms,
  cities: forms,
  districts: forms,
  /** A brand id of brands.json (the real one, not its fake), or a company the lessons name without a brandRef. */
  brands: forms,
  /** The currency code, replaced by the pack's symbol. */
  code: z.array(z.string().min(1)),
  phonePrefix: z.string(),
  /** Checked only: each market replaces them with `phrases` (currency words, the country, MMC, ETX, ASCII words in file and network names). */
  other: z.array(z.string().min(1)),
});
export type AzWorld = z.infer<typeof azWorldSchema>;

const POOLS = ["female", "male", "family", "cities", "districts"] as const;
type Pool = (typeof POOLS)[number];
type Hit = { kind: Pool | "brands" | "code" | "other" | "phrase"; key: string };

/** An Azerbaijani IBAN: AZ, two check digits, a four-letter bank code, twenty digits. */
const AZ_IBAN = /\bAZ\d{2}[A-Z]{4}\d{20}\b/g;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * A whole word, also inside network, file and password names (Kafe_Nargiz_Free, Baki2026!). An Arabic
 * proclitic (و ف ب ل ك) may precede it and a German genitive s may follow it; both are kept.
 */
const wordRegex = (list: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{N}])((?:[وف])?(?:[بلك])?)(${[...list].sort((a, b) => b.length - a.length).map(esc).join("|")})(s?)(?!\\p{L})`, "gu");

type Matcher = { re: RegExp; hits: Map<string, Hit> };
function matcher(world: AzWorld, pack?: MarketPack): Matcher {
  const hits = new Map<string, Hit>();
  for (const kind of [...POOLS, "brands"] as const) for (const [key, list] of Object.entries(world[kind])) for (const f of list) hits.set(f, { kind, key });
  for (const f of world.code) hits.set(f, { kind: "code", key: f });
  for (const f of world.other) hits.set(f, { kind: "other", key: f });
  for (const [f] of pack?.phrases ?? []) hits.set(f, { kind: "phrase", key: f });
  return { re: wordRegex([...hits.keys()]), hits };
}

/** Calls `fn` on the parts of a translatable value outside its addresses; a value that is an address stays whole. */
function outsideAddresses(text: string, fn: (part: string) => string): string {
  if (LOOKS_LIKE_ADDRESS.test(text.trim())) return text;
  const tokens = addressTokens(text);
  if (!tokens.length) return fn(text);
  const split = new RegExp(`(${tokens.sort((a, b) => b.length - a.length).map(esc).join("|")})`, "u");
  return text
    .split(split)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join("");
}

/** Maps every translatable string value (as localeParityErrors reads them) through `fn`, with its JSON path. */
function mapText(doc: unknown, fn: (text: string, path: string) => string, path = "$", key = ""): unknown {
  if (Array.isArray(doc)) return doc.map((v, i) => mapText(v, fn, `${path}[${i}]`, key));
  if (doc && typeof doc === "object") return Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, mapText(v, fn, `${path}.${k}`, k)]));
  if (typeof doc === "string" && TRANSLATABLE.has(key) && !(key === "app" && APP_IDENTIFIERS.has(doc))) return fn(doc, path);
  return doc;
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** A seeded pick per key, without repeats while the pool lasts: the same key always gets the same value for a seed. */
function assign(keys: Iterable<string>, pool: string[], seed: string): Map<string, string> {
  const used = new Set<number>();
  const out = new Map<string, string>();
  for (const key of [...new Set(keys)].sort()) {
    let i = hash(`${seed}\u0000${key}`) % pool.length;
    for (let n = 0; n < pool.length && used.has(i); n++) i = (i + 1) % pool.length;
    used.add(i);
    out.set(key, pool[i]);
  }
  return out;
}

/** The source number's digits in `pattern`, filling its #s from the end ("+994 50 000 47 12" → "+49 151 000 47 12"). */
function fill(pattern: string, digits: string): string {
  let i = digits.length;
  return [...pattern]
    .reverse()
    .map((c) => (c === "#" ? (digits[--i] ?? "0") : c))
    .reverse()
    .join("");
}

/**
 * The lesson with the Azerbaijani world replaced by the pack's: deterministic (people and places are
 * picked per `seed`, the lesson's "module/id", so one character keeps one name through the lesson) and
 * idempotent (no pack value is a token of the world list, which the tests check).
 */
export function applyMarket<T>(doc: T, seed: string, pack: MarketPack, world: AzWorld): T {
  const { re, hits } = matcher(world, pack);
  const phoneRe = new RegExp(`${esc(world.phonePrefix)}[\\d\\s-]*\\d`, "g");
  const found: Record<Pool, string[]> = { female: [], male: [], family: [], cities: [], districts: [] };
  mapText(doc, (text) =>
    outsideAddresses(text, (part) => {
      for (const m of part.matchAll(re)) {
        const hit = hits.get(m[2])!;
        if ((POOLS as readonly string[]).includes(hit.kind)) found[hit.kind as Pool].push(hit.key);
      }
      return part;
    }),
  );
  const pools: Record<Pool, string[]> = { ...pack.people, cities: pack.cities, districts: pack.districts };
  const picked = Object.fromEntries(POOLS.map((p) => [p, assign(found[p], pools[p], `${seed}/${p}`)])) as Record<Pool, Map<string, string>>;
  const phrases = new Map(pack.phrases);
  const replace = (form: string): string => {
    const hit = hits.get(form)!;
    if (hit.kind === "phrase") return phrases.get(form)!;
    if (hit.kind === "brands") return pack.brands[hit.key]?.name ?? form;
    if (hit.kind === "code") return pack.currency.symbol;
    if (hit.kind === "other") return form;
    // "نورة|Noura": a Latin-script form (a password such as Aysel2027 in Arabic text) takes the Latin spelling.
    const [main, latin] = picked[hit.kind].get(hit.key)!.split("|");
    return latin && /\p{Script=Latin}/u.test(form) ? latin : main;
  };
  // Baku landlines start with 12; every other number is taken for a mobile one.
  const phone = (m: string) => {
    const digits = m.replace(/\D/g, "").slice(world.phonePrefix.replace(/\D/g, "").length);
    return fill(digits.startsWith("12") ? pack.phone.landline : pack.phone.mobile, digits);
  };
  const local = (part: string) => {
    let out = "";
    let last = 0;
    for (const m of part.matchAll(re)) {
      const [whole, pre, form, s] = m;
      const to = replace(form);
      let before = part.slice(last, m.index);
      const elided = !pre && /^[^aeiouyhàâéèêëîïôûüœAEIOUYHÀÂÉÈÊËÎÏÔÛÜŒ]/u.test(to) ? pack.elisions.find(([e]) => before.endsWith(e)) : undefined;
      if (elided) before = before.slice(0, -elided[0].length) + elided[1];
      // "T. Abbasov": the initial belongs to the old given name, so it goes ("Staatsanwalt Krause").
      if (!pre && hits.get(form)!.kind === "family") before = before.replace(/(?<!\p{L})\p{L}\. $/u, "");
      out += before + pre + to + s;
      last = m.index + whole.length;
    }
    return (out + part.slice(last)).replace(phoneRe, phone).replace(AZ_IBAN, (m) => fill(pack.iban, m.replace(/\D/g, "")));
  };
  return mapText(doc, (text) => outsideAddresses(text, local)) as T;
}

/** Letters only Azerbaijani uses among the market languages (de, fr, ar); ç, ö and ü are German or French too. */
const AZ_LETTERS = /[əƏıİğĞşŞ]/u;

/** Every token of the Azerbaijani world left in a market language's lesson, outside its addresses, by JSON path. */
export function marketTokenErrors(doc: unknown, world: AzWorld): string[] {
  const { re } = matcher(world);
  const errors: string[] = [];
  mapText(doc, (text, path) =>
    outsideAddresses(text, (part) => {
      const tokens = [...part.matchAll(re)].map((m) => m[2]);
      if (part.includes(world.phonePrefix)) tokens.push(world.phonePrefix);
      tokens.push(...(part.match(AZ_IBAN) ?? []));
      for (const w of part.match(/[\p{L}\p{M}'’-]+/gu) ?? []) if (AZ_LETTERS.test(w)) tokens.push(w);
      for (const token of new Set(tokens)) errors.push(`${path}: "${token}" belongs to the Azerbaijani world`);
      return part;
    }),
  );
  return errors;
}

/** The brand's name in a language: the market pack's analogue, written into brands.json by apply-market. */
export function brandName(brand: Pick<Brand, "name" | "names">, locale: string): string {
  return brand.names?.[locale] ?? brand.name;
}
