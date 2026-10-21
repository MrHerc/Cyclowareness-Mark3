import type { ReactNode } from "react";

type Cell = string | number | Date | null;

function show(v: Cell, fmt: (d: Date) => string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return fmt(v);
  return String(v);
}

/** One printable report section: heading, optional note and a compact table. */
export function ReportSection({ title, note, headers, rows, formatDate, empty }: { title: string; note?: ReactNode; headers: string[]; rows: Cell[][]; formatDate: (d: Date) => string; empty: string }) {
  return (
    <section className="break-inside-avoid-page">
      <h2 className="mt-8 mb-2 text-title-sm font-bold">{title}</h2>
      {note ? <p className="mb-3 text-caption text-ink-muted">{note}</p> : null}
      {rows.length ? (
        <table className="w-full border-collapse text-[0.72rem] leading-snug">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border-b-2 border-ink px-1.5 py-1.5 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="break-inside-avoid odd:bg-sunken/60">
                {r.map((c, j) => (
                  <td key={j} className="border-b border-line px-1.5 py-1 align-top">
                    {show(c, formatDate)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-caption text-ink-muted">{empty}</p>
      )}
    </section>
  );
}

export function DocHeader({ org, title, sub, logo }: { org: string; title: string; sub: string; logo?: string | null }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-4 border-brand-600 pb-5">
      <div>
        <p className="text-caption font-semibold text-ink-muted">{org}</p>
        <h1 className="mt-1 text-headline font-bold">{title}</h1>
        <p className="mt-1 text-caption text-ink-muted">{sub}</p>
      </div>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-16 object-contain" />
      ) : null}
    </header>
  );
}
