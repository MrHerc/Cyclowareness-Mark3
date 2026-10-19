const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or ink, whichever reads better on the given background (WCAG contrast). */
export function readableOn(hex: string): "#ffffff" | "#16123a" {
  const l = luminance(hex);
  const ink = luminance("#16123a");
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (ink + 0.05);
  return onWhite >= onInk ? "#ffffff" : "#16123a";
}

/** CSS custom properties for a tenant's brand, falling back to the defaults on bad input. */
export function brandStyle(primary?: string | null, accent?: string | null): Record<string, string> {
  const p = isHexColor(primary) ? primary : "#4f46e5";
  const a = isHexColor(accent) ? accent : "#ff7a1a";
  return { "--brand": p, "--brand-on": readableOn(p), "--accent": a, "--accent-on": readableOn(a) };
}
