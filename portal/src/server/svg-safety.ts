/**
 * Safety check for uploaded SVG logos (served to every learner). Scripts, event handlers,
 * foreign objects and references to anything outside the file are refused; internal references
 * such as gradients, <use href="#a"> and clip-path="url(#c)" are what design tools export and are fine.
 * Returns null when the SVG is acceptable.
 */
export function svgLogoProblem(svg: string): "script" | "handler" | "external_ref" | null {
  if (/<script\b|<foreignObject\b|<iframe\b|<embed\b|<object\b|javascript:|vbscript:|<!ENTITY|<\?xml-stylesheet/i.test(svg)) return "script";
  if (/(?:^|[\s"'/])on[a-z]+\s*=/i.test(svg)) return "handler";
  const fragmentOnly = (value: string) => value.trim().startsWith("#");
  // Every href / xlink:href value, quoted or bare, must point inside the document.
  for (const m of svg.matchAll(/(?:^|[\s"'/])(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi)) {
    if (!fragmentOnly(m[1] ?? m[2] ?? m[3] ?? "")) return "external_ref";
  }
  // url(...) in presentation attributes, style attributes and <style> blocks.
  for (const m of svg.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    if (!fragmentOnly(m[1] ?? m[2] ?? m[3] ?? "")) return "external_ref";
  }
  if (/@import\b/i.test(svg)) return "external_ref";
  return null;
}
