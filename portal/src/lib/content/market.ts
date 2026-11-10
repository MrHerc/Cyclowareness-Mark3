/**
 * Market packs: the people, places, money, phone numbers, authorities and brand analogues a language's
 * lessons use instead of the Azerbaijani world of the English source (content/market/<lang>.json).
 * scripts/apply-market.ts rewrites a market language's lesson files with applyMarket(); the lesson checker
 * fails a market language whose text or addresses still hold a token of the Azerbaijani world list
 * (content/market/az-world.json, marketTokenErrors()). Only translatable text and links (`href`) change, so
 * ids, answers and branches are untouched. Addresses are rewritten from the English source through the
 * pack's address map, so a renamed sender keeps a matching mailbox and a renamed brand its domain; parity
 * then compares a market translation with marketSource(), the English lesson through the same map.
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
    /** "Arabic|Latin" pairs a script's spelling with the Latin one used inside passwords, network names and addresses. */
    people: z.object({ female: names, male: names, family: names }),
    cities: names,
    districts: names,
    /** `symbol` replaces the code AZN; currency words (manat) are `phrases`, since they inflect. */
    currency: z.object({ code: z.string(), symbol: z.string() }),
    /** Typical amounts per class, in the pack's currency; the salary sentences of the lessons follow them through `phrases`. */
    amounts: z.object({ salary: z.number().nonnegative(), invoice: z.number().nonnegative(), fine: z.number().nonnegative(), giftCard: z.number().nonnegative() }),
    /** Number patterns: each # takes a digit of the source number, filled from the end. */
    phone: z.object({ code: z.string(), mobile: z.string(), landline: z.string() }),
    iban: z.string(),
    government: z.object({ tax: z.string(), police: z.string(), courts: z.string(), socialInsurance: z.string() }),
    /** Keyed like az-world.json `brands`; `domain` is fictional, its first label replaces the brand's slugs (az-world `brandSlugs`) in addresses. */
    brands: z.record(z.string(), z.object({ name: z.string().min(1), domain: z.string().min(1), description: z.string().min(1) })),
    /** Language-specific rewrites (inflected authority names, currency words, emergency numbers), whole words only. */
    phrases: z.array(z.tuple([z.string().min(1), z.string()])),
    /** Elided articles undone before a replacement that starts with a consonant (fr: d’Aysel → de Camille). */
    elisions: z.array(z.tuple([z.string().min(1), z.string().min(1)])),
    /** Titles before which a given name of the source becomes a family name ("Herr Kamran" → "Herr Becker"). */
    honorifics: z.array(z.string().min(1)).default([]),
    /** Every word of az-world `addressWords` to its local form inside addresses (case-insensitive, whole words). */
    addresses: z.record(z.string(), z.string().min(1)).default({}),
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
  /** A brand id of `brands` to the slugs its addresses use (ulduzbank.az, ofis-techizat.az), replaced by the pack's domain. */
  brandSlugs: z.record(z.string(), z.array(z.string().min(1)).min(1)),
  /** Azerbaijani words, the country label `az` and look-alike slugs inside addresses, each mapped by every pack's `addresses`. */
  addressWords: z.array(z.string().min(1)),
});
export type AzWorld = z.infer<typeof azWorldSchema>;

const POOLS = ["female", "male", "family", "cities", "districts"] as const;
type Pool = (typeof POOLS)[number];
type Person = "female" | "male" | "family";
type Hit = { kind: Pool | "brands" | "code" | "other" | "phrase"; key: string };

/** An Azerbaijani IBAN: AZ, two check digits, a four-letter bank code, twenty digits, also in groups of four. */
const AZ_IBAN = /\bAZ\d{2} ?[A-Z]{4}(?: ?\d{4}){5}\b/g;
/** The country left in prose: ".az", "-az.com", a parcel number ending in AZ. */
const AZ_SUFFIX = /(?<![\p{L}\p{N}])[.-]az(?![\p{L}\p{N}])|\d+AZ(?!\p{L})/gu;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byLength = (a: string, b: string) => b.length - a.length;
/**
 * A whole word, also inside network, file and password names (Kafe_Nargiz_Free, Baki2026!). An Arabic
 * proclitic (و ف ب ل ك) and the article (ال, لل) may precede it and a German genitive s may follow it;
 * all are kept. The article is tried last, so a form that starts with it ("المانات") wins.
 */
const wordRegex = (list: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{N}])((?:[وف])?(?:[بك]?ال|لل|[بلك])??)(${[...list].sort(byLength).map(esc).join("|")})(s?)(?!\\p{L})`, "gu");
/** A word inside an address, with no letter touching it on either side (rxagentlik-az.com, hasanova85@). */
const addressRegex = (list: Iterable<string>) => new RegExp(`(?<!\\p{L})(${[...list].sort(byLength).map(esc).join("|")})(?!\\p{L})`, "giu");

type Matcher = { re: RegExp; hits: Map<string, Hit> };
function matcher(world: AzWorld, pack?: MarketPack): Matcher {
  const hits = new Map<string, Hit>();
  for (const kind of [...POOLS, "brands"] as const) for (const [key, list] of Object.entries(world[kind])) for (const f of list) hits.set(f, { kind, key });
  for (const f of world.code) hits.set(f, { kind: "code", key: f });
  for (const f of world.other) hits.set(f, { kind: "other", key: f });
  for (const [f] of pack?.phrases ?? []) hits.set(f, { kind: "phrase", key: f });
  return { re: wordRegex([...hits.keys()]), hits };
}

/** A name as an address writes it: "Rəşad" → "reshad", "Müller" → "mueller", "نورة|Noura" → "noura". */
function addressForm(name: string): string {
  return (name.split("|")[1] ?? name)
    .toLowerCase()
    .replace(/ş/g, "sh")
    .replace(/ç/g, "ch")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" })[c]!)
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[^a-z-]/g, "");
}

/** Every Latin person form of the world as an address writes it, with its pool and key. */
function addressPeople(world: AzWorld): Map<string, { kind: Person; key: string }> {
  const out = new Map<string, { kind: Person; key: string }>();
  for (const kind of ["female", "male", "family"] as const)
    for (const [key, list] of Object.entries(world[kind])) for (const f of list) if (/^\p{Script=Latin}/u.test(f)) out.set(addressForm(f), { kind, key });
  return out;
}

type Place = { kind: "cities" | "districts"; key: string; form: string };
/** Every Latin city and district form of the world as an address writes it ("free-wifi-baku.top"), with its pool, key and form. */
function addressPlaces(world: AzWorld): Map<string, Place> {
  const out = new Map<string, Place>();
  for (const kind of ["cities", "districts"] as const)
    for (const [key, list] of Object.entries(world[kind])) for (const f of list) if (/^\p{Script=Latin}/u.test(f) && !out.has(addressForm(f))) out.set(addressForm(f), { kind, key, form: f });
  return out;
}

/** A piece of an address split across spans: a path ("/giris") or a slug ("dovletportal-az"). */
const ADDRESS_PIECE = /^(?=.*[/-])[a-z0-9/._?=&+%-]+$/;

/** The address tokens of a value: the whole value when it is an address, a link or a piece of one. */
function valueAddresses(text: string, key: string): string[] {
  const whole = text.trim();
  if (key === "href" || LOOKS_LIKE_ADDRESS.test(whole) || ADDRESS_PIECE.test(whole)) return whole ? [whole] : [];
  return addressTokens(text);
}

/** Calls `fn` on the parts of a translatable value outside its addresses; a value that is an address stays whole. */
function outsideAddresses(text: string, fn: (part: string) => string): string {
  if (LOOKS_LIKE_ADDRESS.test(text.trim()) || ADDRESS_PIECE.test(text.trim())) return text;
  const tokens = addressTokens(text);
  if (!tokens.length) return fn(text);
  const split = new RegExp(`(${tokens.sort(byLength).map(esc).join("|")})`, "u");
  return text
    .split(split)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join("");
}

/**
 * Maps every translatable string value (as localeParityErrors reads them) and every link (`href`) through
 * `fn`, with the value at the same place in `en` (the value itself where `en` has none).
 */
function mapText(doc: unknown, fn: (text: string, en: string, key: string, path: string) => string, en: unknown = doc, path = "$", key = ""): unknown {
  if (Array.isArray(doc)) return doc.map((v, i) => mapText(v, fn, Array.isArray(en) ? en[i] : v, `${path}[${i}]`, key));
  if (doc && typeof doc === "object") {
    const other = en && typeof en === "object" && !Array.isArray(en) ? (en as Record<string, unknown>) : {};
    return Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, mapText(v, fn, k in other ? other[k] : v, `${path}.${k}`, k)]));
  }
  if (typeof doc === "string" && ((TRANSLATABLE.has(key) && !(key === "app" && APP_IDENTIFIERS.has(doc))) || key === "href"))
    return fn(doc, typeof en === "string" ? en : doc, key, path);
  return doc;
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * A seeded pick per key, without repeats while the pool lasts: the same key always gets the same value
 * for a seed. The `first` keys (the English source's) are cast first, so a key only a translation adds
 * never moves them.
 */
function assign(first: string[], then: string[], pool: string[], seed: string): Map<string, string> {
  const used = new Set<number>();
  const out = new Map<string, string>();
  const primary = [...new Set(first)].sort();
  for (const key of [...primary, ...[...new Set(then)].filter((k) => !primary.includes(k)).sort()]) {
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

type Cast = { picked: Record<Pool, Map<string, string>>; familyOf: Map<string, string>; givenOf: Map<string, string> };

/**
 * Who plays whom in a lesson: the people and places of the English source (its text and its addresses),
 * then those only the translation names, picked per `seed` (the lesson's "module/id"). `familyOf` and
 * `givenOf` pair the names the English writes together ("Rauf Kərimov"), for an initial in an address
 * (r.kerimov@) and a title before a given name; a title without a pair gets a family name of its own ("~rauf").
 */
function castFor(en: unknown, doc: unknown, seed: string, pack: MarketPack, world: AzWorld, { re, hits }: Matcher): Cast {
  const people = addressPeople(world);
  const peopleRe = addressRegex(people.keys());
  const empty = (): Record<Pool, string[]> => ({ female: [], male: [], family: [], cities: [], districts: [] });
  const fromEn = empty();
  const fromDoc = empty();
  const familyOf = new Map<string, string>();
  const givenOf = new Map<string, string>();
  const scan = (part: string, into: Record<Pool, string[]>, source: boolean) => {
    let given: { key: string; end: number } | undefined;
    for (const m of part.matchAll(re)) {
      const hit = hits.get(m[2])!;
      if (!(POOLS as readonly string[]).includes(hit.kind)) continue;
      into[hit.kind as Pool].push(hit.key);
      if (source && given && hit.kind === "family" && /^\s+$/u.test(part.slice(given.end, m.index + m[1].length))) {
        if (!familyOf.has(given.key)) familyOf.set(given.key, hit.key);
        if (!givenOf.has(hit.key)) givenOf.set(hit.key, given.key);
      }
      const isGiven = hit.kind === "female" || hit.kind === "male";
      if (!source && isGiven && !m[1] && pack.honorifics.some((h) => part.slice(0, m.index).endsWith(`${h} `))) into.family.push(`~${hit.key}`);
      given = isGiven ? { key: hit.key, end: m.index + m[0].length } : undefined;
    }
  };
  mapText(en, (text, _en, key) => {
    for (const token of valueAddresses(text, key)) for (const m of token.matchAll(peopleRe)) fromEn[people.get(m[1].toLowerCase())!.kind].push(people.get(m[1].toLowerCase())!.key);
    if (key !== "href") outsideAddresses(text, (part) => (scan(part, fromEn, true), part));
    return text;
  });
  mapText(doc, (text, _en, key) => (key === "href" ? text : outsideAddresses(text, (part) => (scan(part, fromDoc, false), part))));
  // A title before a given name the English pairs with a family name takes that family name.
  fromDoc.family = fromDoc.family.filter((k) => !(k.startsWith("~") && familyOf.has(k.slice(1))));
  const pools: Record<Pool, string[]> = { ...pack.people, cities: pack.cities, districts: pack.districts };
  const picked = Object.fromEntries(POOLS.map((p) => [p, assign(fromEn[p], fromDoc[p], pools[p], `${seed}/${p}`)])) as Record<Pool, Map<string, string>>;
  return { picked, familyOf, givenOf };
}

/** The pack's address map for one lesson: brand slugs, Azerbaijani words and the names of the lesson's cast. */
function addressMapper(pack: MarketPack, world: AzWorld, cast: Cast): (token: string) => string {
  const people = addressPeople(world);
  const words = new Map<string, string>();
  for (const [id, slugs] of Object.entries(world.brandSlugs)) {
    const slug = pack.brands[id]?.domain.split(".")[0];
    if (slug) for (const s of slugs) words.set(s.toLowerCase(), slug);
  }
  for (const [w, to] of Object.entries(pack.addresses)) words.set(w.toLowerCase(), to);
  // A place follows the text: the pack's phrase for its form ("Baku" → "Berlin"), else the lesson's cast.
  const phrases = new Map(pack.phrases);
  for (const [form, place] of addressPlaces(world)) {
    const to = phrases.get(place.form) ?? cast.picked[place.kind].get(place.key);
    if (to) words.set(form, addressForm(to));
  }
  // An initial before a family name (r.kerimov@) or after a given name (kamran.h@) follows the pair.
  const re = new RegExp(`(?<!\\p{L})(?:(\\p{L})\\.)?(${[...words.keys(), ...people.keys()].sort(byLength).map(esc).join("|")})(?:\\.(\\p{L})(?!\\p{L}))?(?!\\p{L})`, "giu");
  const slug = (key: string | undefined) => {
    for (const kind of ["female", "male", "family"] as const) if (key && cast.picked[kind].has(key)) return addressForm(cast.picked[kind].get(key)!);
  };
  const caseLike = (from: string, to: string) => (/\p{Lu}/u.test(from[0]) ? to[0].toUpperCase() + to.slice(1) : to);
  // A piece cut after "gov." ("https://vetendasportal.gov." + "az-arayis.example") takes the label the pack gives gov.az ("bund.").
  const gov = pack.addresses["gov.az"]?.split(".")[0];
  const official = (out: string) => (gov && out.endsWith(".gov.") ? `${out.slice(0, -"gov.".length)}${gov}.` : out);
  return (token) =>
    official(token.replace(re, (whole: string, before: string | undefined, form: string, after: string | undefined) => {
      const person = people.get(form.toLowerCase());
      if (!person) return `${before ? `${before}.` : ""}${caseLike(form, words.get(form.toLowerCase())!)}${after ? `.${after}` : ""}`;
      const to = slug(person.key);
      if (!to) return whole;
      const pair = slug(person.kind === "family" ? cast.givenOf.get(person.key) : cast.familyOf.get(person.key));
      if (before && person.kind === "family" && pair) before = pair[0];
      if (after && person.kind !== "family" && pair) after = pair[0];
      return `${before ? `${before}.` : ""}${caseLike(form, to)}${after ? `.${after}` : ""}`;
    }));
}

/** Rewrites the addresses of `text` where they still equal the English value's (`en`); any other text stays. */
function mapAddresses(text: string, en: string, key: string, map: (token: string) => string): string {
  const tokens = valueAddresses(en, key);
  if (!tokens.length) return text;
  if (tokens[0] === en.trim()) return text.trim() === tokens[0] ? text.replace(tokens[0], map(tokens[0])) : text;
  return text.replace(new RegExp(tokens.sort(byLength).map(esc).join("|"), "gu"), map);
}

/** The English lesson with its addresses through the pack's map: what a market translation must match (parity). */
export function marketSource<T>(en: T, seed: string, pack: MarketPack, world: AzWorld): T {
  const map = addressMapper(pack, world, castFor(en, en, seed, pack, world, matcher(world, pack)));
  return mapText(en, (text, _en, key) => mapAddresses(text, text, key, map)) as T;
}

/**
 * The lesson with the Azerbaijani world replaced by the pack's: deterministic (people and places are
 * picked per `seed`, the lesson's "module/id", from its English source `en`, so one character keeps one
 * name through the lesson, in its text and in its addresses) and idempotent (no pack value is a token of
 * the world list, which the tests check, and an address is only rewritten while it equals the English one).
 */
export function applyMarket<T>(doc: T, seed: string, pack: MarketPack, world: AzWorld, en: unknown = doc): T {
  const m = matcher(world, pack);
  const { re, hits } = m;
  const cast = castFor(en, doc, seed, pack, world, m);
  const { picked } = cast;
  const phoneRe = new RegExp(`${esc(world.phonePrefix)}[\\d\\s-]*\\d`, "g");
  const phrases = new Map(pack.phrases);
  const person = (kind: Pool, key: string, form: string): string => {
    // "نورة|Noura": a Latin-script form (a password such as Aysel2027 in Arabic text) takes the Latin spelling.
    const [main, latin] = picked[kind].get(key)!.split("|");
    return latin && /\p{Script=Latin}/u.test(form) ? latin : main;
  };
  const replace = (form: string, before: string): string => {
    const hit = hits.get(form)!;
    if (hit.kind === "phrase") return phrases.get(form)!;
    if (hit.kind === "brands") return pack.brands[hit.key]?.name ?? form;
    if (hit.kind === "code") return pack.currency.symbol;
    if (hit.kind === "other") return form;
    if ((hit.kind === "female" || hit.kind === "male") && pack.honorifics.some((h) => before.endsWith(`${h} `))) {
      const family = cast.familyOf.get(hit.key) ?? `~${hit.key}`;
      if (picked.family.has(family)) return person("family", family, form);
    }
    return person(hit.kind, hit.key, form);
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
      let before = part.slice(last, m.index);
      const to = replace(form, pre ? "" : part.slice(0, m.index));
      const elided = !pre && /^[^aeiouyhàâéèêëîïôûüœAEIOUYHÀÂÉÈÊËÎÏÔÛÜŒ]/u.test(to) ? pack.elisions.find(([e]) => before.endsWith(e)) : undefined;
      if (elided) before = before.slice(0, -elided[0].length) + elided[1];
      // "T. Abbasov": the initial belongs to the old given name, so it goes ("Staatsanwalt Krause").
      if (!pre && hits.get(form)!.kind === "family") before = before.replace(/(?<!\p{L})\p{L}\. $/u, "");
      out += before + pre + to + s;
      last = m.index + whole.length;
    }
    return (out + part.slice(last)).replace(phoneRe, phone).replace(AZ_IBAN, (m) => {
      // A grouped source IBAN stays grouped.
      const iban = fill(pack.iban, m.replace(/\D/g, ""));
      return m.includes(" ") ? iban.replace(/(.{4})(?=.)/g, "$1 ") : iban;
    });
  };
  const texted = mapText(doc, (text, _en, key) => (key === "href" ? text : outsideAddresses(text, local)));
  const map = addressMapper(pack, world, cast);
  return mapText(texted, (text, enText, key) => mapAddresses(text, enText, key, map), en) as T;
}

/** Letters only Azerbaijani uses among the market languages (de, fr, ar); ç, ö and ü are German or French too. */
const AZ_LETTERS = /[əƏıİğĞşŞ]/u;

/**
 * Every token of the Azerbaijani world left in a market language's lesson, by JSON path: in its text
 * (outside addresses) and, given the market's `pack`, inside its addresses (people, brand slugs and the
 * address words the pack changes).
 */
export function marketTokenErrors(doc: unknown, world: AzWorld, pack?: MarketPack): string[] {
  const { re } = matcher(world);
  const kept = (w: string) => pack?.addresses[w]?.toLowerCase() === w.toLowerCase();
  const inAddresses = pack && addressRegex([...addressPeople(world).keys(), ...addressPlaces(world).keys(), ...Object.values(world.brandSlugs).flat(), ...world.addressWords.filter((w) => !kept(w))]);
  const errors: string[] = [];
  mapText(doc, (text, _en, key, path) => {
    const tokens: string[] = [];
    if (inAddresses) for (const address of valueAddresses(text, key)) for (const m of address.matchAll(inAddresses)) tokens.push(`${m[1]}" in "${address}`);
    if (key !== "href")
      outsideAddresses(text, (part) => {
        tokens.push(...[...part.matchAll(re)].map((m) => m[2]));
        if (part.includes(world.phonePrefix)) tokens.push(world.phonePrefix);
        tokens.push(...(part.match(AZ_IBAN) ?? []), ...(part.match(AZ_SUFFIX) ?? []));
        for (const w of part.match(/[\p{L}\p{M}'’-]+/gu) ?? []) if (AZ_LETTERS.test(w)) tokens.push(w);
        return part;
      });
    for (const token of new Set(tokens)) errors.push(`${path}: "${token}" belongs to the Azerbaijani world`);
    return text;
  });
  return errors;
}

/** The brand's name in a language: the market pack's analogue, written into brands.json by apply-market. */
export function brandName(brand: Pick<Brand, "name" | "names">, locale: string): string {
  return brand.names?.[locale] ?? brand.name;
}
