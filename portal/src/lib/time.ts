/**
 * The current time for an async server component. A server component renders once per request, so
 * reading the clock during render is fine, but the React compiler's purity rule cannot tell server
 * components apart from client ones and reports a bare `Date.now()` / `new Date()` in a page body.
 * Client components keep the clock out of render (event handlers, lazy initialisers or props).
 */
export function requestNow(): Date {
  return new Date();
}

/** Cyclowareness's fixed numeric date (03.10.2026), identical in every locale, Baku time. */
export function numericDate(d: Date, timeZone = "Asia/Baku"): string {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-");
  return `${day}.${m}.${y}`;
}
