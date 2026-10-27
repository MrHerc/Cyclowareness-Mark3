/**
 * Inline markup of notification templates: **bold**, _italic_ and [text](https://…).
 * Bare URLs are kept as plain text, so underscores inside them never turn into italics. A backslash keeps
 * the next markup character literal (\*, \_, \[, \], \:, \\); escapeEmailMarkup() writes such escapes.
 * Shared by the email renderer and the settings preview so both read a template the same way.
 */
export type MarkupToken = { kind: "text" | "bold" | "italic"; text: string } | { kind: "link"; text: string; href: string };

const LINK_OR_URL = /(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/\S+)/;
const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/;
const EMPHASIS = /\*\*([^*\n]+)\*\*|(^|\s)_([^_\n]+)_(?=\s|$|[.,!?:;)])/g;

// Escaped characters become private-use stand-ins while parsing and are turned back in each token.
const ESCAPED = /\\([\\*_[\]:])/g;
const STAND_IN = /[\ue02a\ue03a\ue05b-\ue05d\ue05f]/g;
const hide = (s: string) => s.replace(ESCAPED, (_, c: string) => String.fromCharCode(0xe000 + c.charCodeAt(0)));
const show = (s: string) => s.replace(STAND_IN, (c) => String.fromCharCode(c.charCodeAt(0) - 0xe000));

/** A value filled into a template (a person's or organisation's name) that must read as text, never as markup or a link. */
export function escapeEmailMarkup(value: string): string {
  return value.replace(/[\\*_[\]:]/g, "\\$&");
}

export function parseEmailMarkup(text: string): MarkupToken[] {
  const out: MarkupToken[] = [];
  const push = (token: MarkupToken) => {
    token.text = show(token.text);
    if (token.kind === "link") token.href = show(token.href);
    if (token.text) out.push(token);
  };
  hide(text).split(LINK_OR_URL).forEach((part, i) => {
    if (i % 2) {
      const link = LINK.exec(part);
      push(link ? { kind: "link", text: link[1], href: link[2] } : { kind: "text", text: part });
      return;
    }
    let last = 0;
    for (const m of part.matchAll(EMPHASIS)) {
      push({ kind: "text", text: part.slice(last, m.index) + (m[2] ?? "") });
      push(m[1] !== undefined ? { kind: "bold", text: m[1] } : { kind: "italic", text: m[3] });
      last = m.index + m[0].length;
    }
    push({ kind: "text", text: part.slice(last) });
  });
  return out;
}

/** Plain-text version for the text/plain part: markers removed, links written as "text (url)". */
export function stripEmailMarkup(text: string): string {
  return parseEmailMarkup(text)
    .map((t) => (t.kind === "link" ? `${t.text} (${t.href})` : t.text))
    .join("");
}
