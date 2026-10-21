/** International phone number as stored (sign-in by phone, SMS): + and 8–15 digits. */
export const PHONE_PATTERN = /^\+\d{8,15}$/;

/**
 * A phone as people type it: spaces, brackets, dashes, dots (French-style grouping) and one leading
 * apostrophe (spreadsheet text marker) removed. The one rule for sign-in, the admin dialogs and the
 * CSV import, so every entry point accepts the same spellings of a number.
 */
export function cleanPhone(raw: string): string {
  return raw.trim().replace(/^'/, "").replace(/[\s().-]/g, "");
}
