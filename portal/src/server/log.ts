/**
 * Server log: one line per event. In production a JSON object {ts, level, msg, ...fields} that a
 * log collector can index by tenantId, userId or requestId; elsewhere the same event as readable text.
 * Errors go through logFailure (db/errors.ts), which keeps a failed query's parameters out of the log.
 */
export type LogLevel = "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export function formatLog(level: LogLevel, msg: string, fields: LogFields = {}, pretty = process.env.NODE_ENV !== "production", now = new Date()): string {
  if (!pretty) return JSON.stringify({ ts: now.toISOString(), level, msg, ...fields });
  const extra = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  return [now.toISOString(), level.toUpperCase(), msg, ...extra].join(" ");
}

function write(level: LogLevel, msg: string, fields?: LogFields): void {
  const line = formatLog(level, msg, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
};
