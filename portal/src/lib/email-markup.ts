/**
 * Inline markup of notification templates: **bold**, _italic_ and [text](https://…).
 * Bare URLs are kept as plain text, so underscores inside them never turn into italics.
 * Shared by the email renderer and the settings preview so both read a template the same way.
 */
export type MarkupToken = { kind: "text" | "bold" | "italic"; text: string } | { kind: "link"; text: string; href: string };

const LINK_OR_URL = /(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/\S+)/;
const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/;
const EMPHASIS = /\*\*([^*\n]+)\*\*|(^|\s)_([^_\n]+)_(?=\s|$|[.,!?:;)])/g;

export function parseEmailMarkup(text: string): MarkupToken[] {
  const out: MarkupToken[] = [];
  const push = (token: MarkupToken) => void (token.text && out.push(token));
  text.split(LINK_OR_URL).forEach((part, i) => {
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
