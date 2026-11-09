import type { ReactNode } from "react";

/**
 * Small, safe Markdown renderer for policies and legal texts: headings, paragraphs, bullet
 * and numbered lists, bold, italics and links. Produces React elements, never raw HTML.
 */
export type Heading = { id: string; text: string; level: number };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  // A link's text and address stop at the next "[", where the next link could start: otherwise every
  // unclosed "[" re-scans to the end of the paragraph (quadratic on a policy full of "[").
  // A path must not start with "//" or "/\" (browsers read both as another host, as safePath does).
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^[\]]+)\]\((https?:\/\/[^\s)[]+|\/(?![/\\])[^\s)[]*)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) out.push(<strong key={`${key}-b${i}`}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={`${key}-i${i}`}>{m[3]}</em>);
    else if (m[4] && m[5]) {
      const external = m[5].startsWith("http");
      out.push(
        <a key={`${key}-a${i}`} href={m[5]} className="font-semibold text-brand-600 underline" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Text of an inline Markdown fragment without its markup, for accessible names. */
export function plainText(text: string): string {
  return text
    .replace(/\[([^[\]]+)\]\([^)[]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function headingsOf(md: string): Heading[] {
  return md
    .split("\n")
    .map((l) => /^(#{2,3})\s+(.+)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ id: slugify(m[2]), text: m[2], level: m[1].length }));
}

export function Markdown({ source, skipTitle = false }: { source: string; skipTitle?: boolean }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let table: string[][] | null = null;
  let heading: string | null = null;
  let k = 0;
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${k++}`}>{inline(para.join(" "), `p${k}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${k}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={`o${k++}`} className="list-decimal ps-6">{items}</ol> : <ul key={`u${k++}`} className="list-disc ps-6">{items}</ul>);
    list = null;
  };
  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    const key = k++;
    // The wrapper scrolls sideways on narrow screens, so keyboard users must be able to focus it;
    // it is named after the section it belongs to, or its column headers when there is none.
    const label = heading ?? head.map(plainText).filter(Boolean).join(", ");
    blocks.push(
      <div key={`t${key}`} tabIndex={0} role="region" aria-label={label || undefined} className="overflow-x-auto rounded-lg ring-1 ring-line">
        <table className="w-full min-w-[36rem] text-start text-body-sm">
          <thead className="bg-sunken">
            <tr>
              {head.map((c, i) => (
                <th key={i} scope="col" className="px-4 py-2.5 font-semibold">
                  {inline(c, `th${key}-${i}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className="px-4 py-2.5 align-top">
                    {inline(c, `td${key}-${ri}-${ci}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    table = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("<!--")) continue;
    if (line.startsWith("|") && line.endsWith("|")) {
      flushPara();
      flushList();
      const cells = line
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((c) => c.trim().replace(/\\\|/g, "|"));
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
      (table ??= []).push(cells);
      continue;
    }
    flushTable();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    // Numbered clauses ("3.1. …") are paragraphs of their own, as in legal texts and policies.
    if (/^\d+(\.\d+)+\.?\s/.test(line)) {
      flushPara();
      flushList();
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      heading = plainText(h[2]);
      if (h[1].length === 1) {
        if (!skipTitle) blocks.push(<h1 key={`h${k++}`}>{h[2]}</h1>);
      } else {
        const Tag = h[1].length === 2 ? "h2" : "h3";
        blocks.push(
          <Tag key={`h${k++}`} id={slugify(h[2])} className="scroll-mt-24">
            {h[2]}
          </Tag>,
        );
      }
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+\)\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  flushTable();
  return (
    <div className="grid gap-4 text-body leading-relaxed text-ink [&_h1]:text-headline [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-title [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:text-title-sm [&_h3]:font-semibold [&_li]:mt-1.5">
      {blocks}
    </div>
  );
}
