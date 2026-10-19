/** "https://evil.top/x" -> "hxxps://evil[.]top/x": safe to display, copy and put in reports. */
export function defang(value: string): string {
  return value.replace(/^http/i, "hxxp").replace(/\./g, "[.]");
}
