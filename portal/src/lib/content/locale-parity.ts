/**
 * A translated lesson (`<id>.az.json`, `<id>.ru.json`) must be the English lesson with only its human
 * text changed: the same scenes, ids, spots, brands, links, answers and branches, so answers, resume
 * state, hotspots and highlights keep working in every language.
 *
 * Keys in TRANSLATABLE hold text a learner reads or hears; their string values may differ (and must not
 * be empty, except plain spans that only carry spacing), but every address they contain stays as it is.
 * Every other string, number and boolean must be identical, and every array must keep its length.
 */
export const TRANSLATABLE = new Set([
  "say",
  "spoken",
  "title",
  "text",
  "label",
  "prompt",
  "feedback",
  "explain",
  "intro",
  "points",
  "tips",
  "buttons",
  "button",
  "fields",
  "left",
  "right",
  "speaker",
  "reveal",
  "size",
  "value",
  "body",
  "subject",
  "name",
  // The app shown on a notification or permission ("Settings", "IT Security"), except APP_IDENTIFIERS.
  "app",
  // The e-mail's To line ("you", "Anar Hasanov"); the addresses in it stay (addressTokens).
  "to",
  // A login page's display name ("Office portal", "Family support"); the brandRef next to it stays.
  "brand",
]);

/**
 * `app` values that are identifiers, not labels, and must stay byte-identical: the chat artifact's
 * messenger. The player compares "whatsapp" and "telegram" (`ChatView` in
 * src/components/player/artifacts.tsx picks the header and wallpaper colours); "generic" is the library's
 * value for any other messenger and "chat" the one the AI lesson format asks for (src/server/ai.ts), both
 * shown with the default colours.
 */
export const APP_IDENTIFIERS = new Set(["whatsapp", "telegram", "generic", "chat"]);

/** Values that are addresses or identifiers and must never be translated, even under a translatable key. */
const LOOKS_LIKE_ADDRESS = /^(https?:\/\/|www\.)|^[^\s@]+@[^\s@]+$|^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

const URL_TOKEN = /(?:https?:\/\/|www\.)[^\s<>"'«»“”‘’]+/giu;
// Also either half of an address split across spans ("r.mammadli@", "@idare.example").
const EMAIL_TOKEN = /[\p{L}\p{N}._%+-]*@[\p{L}\p{N}-]*(?:\.[\p{L}\p{N}-]+)*/gu;
// A dotted name ending in a label of letters, with an optional path ("ispoct-mail.example.net/kvota").
const DOMAIN_TOKEN = /(?<![\p{L}\p{N}_-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}{2,}(?![\p{L}\p{N}_-]|\.[\p{L}\p{N}])(?:\/[^\s<>"'«»“”‘’]*)?/gu;
// A dotted name ending in one of these is a file name, which a translation may localise when it is not
// the whole value (`Budget draft 2027, final.xlsx`); a whole-value file name is kept by LOOKS_LIKE_ADDRESS.
const FILE_EXTENSIONS = new Set(["apk", "csv", "doc", "docm", "docx", "exe", "htm", "html", "img", "iso", "jpeg", "jpg", "lnk", "msi", "pdf", "png", "ppt", "pptx", "rar", "txt", "xls", "xlsm", "xlsx", "zip"]);
const TRAILING_PUNCTUATION = /[.,;:!?…)\]}]+$/u;

/** The e-mail addresses, URLs and domain-like names inside a text, each of which a translation must contain unchanged. */
export function addressTokens(text: string): string[] {
  const found = new Set<string>();
  const add = (m: string) => {
    const token = m.replace(TRAILING_PUNCTUATION, "");
    if (token) found.add(token);
  };
  // URLs, then e-mail addresses, are cut out first so that their domains are not counted again.
  const cut = (m: string) => {
    add(m);
    return " ";
  };
  const rest = text.replace(URL_TOKEN, cut).replace(EMAIL_TOKEN, cut);
  for (const [m] of rest.matchAll(DOMAIN_TOKEN)) {
    const host = m.split("/")[0];
    if (!FILE_EXTENSIONS.has(host.slice(host.lastIndexOf(".") + 1).toLowerCase())) add(m);
  }
  return [...found];
}

export function localeParityErrors(en: unknown, other: unknown, path = "$", key = ""): string[] {
  if (Array.isArray(en)) {
    if (!Array.isArray(other)) return [`${path}: expected an array`];
    if (en.length !== other.length) return [`${path}: ${other.length} items, English has ${en.length}`];
    return en.flatMap((v, i) => localeParityErrors(v, other[i], `${path}[${i}]`, key));
  }
  if (en && typeof en === "object") {
    if (!other || typeof other !== "object" || Array.isArray(other)) return [`${path}: expected an object`];
    const a = Object.keys(en).sort().join(",");
    const b = Object.keys(other).sort().join(",");
    if (a !== b) return [`${path}: keys {${b}} differ from English {${a}}`];
    return Object.keys(en).flatMap((k) => localeParityErrors((en as Record<string, unknown>)[k], (other as Record<string, unknown>)[k], `${path}.${k}`, k));
  }
  if (typeof en === "string" && TRANSLATABLE.has(key) && !(key === "app" && APP_IDENTIFIERS.has(en))) {
    if (typeof other !== "string") return [`${path}: expected a string`];
    if (en.trim() !== "" && other.trim() === "" && /\p{L}/u.test(en)) return [`${path}: empty translation`];
    if (LOOKS_LIKE_ADDRESS.test(en.trim()) && other.trim() !== en.trim()) return [`${path}: address or domain "${en}" must stay unchanged`];
    return addressTokens(en)
      .filter((token) => !other.includes(token))
      .map((token) => `${path}: address or domain "${token}" must stay unchanged`);
  }
  return en === other ? [] : [`${path}: must stay ${JSON.stringify(en)} (got ${JSON.stringify(other)})`];
}
