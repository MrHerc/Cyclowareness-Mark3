/**
 * Safety check for uploaded SVG logos (served to every learner). Scripts, event handlers,
 * foreign objects and references to anything outside the file are refused; internal references
 * such as gradients, <use href="#a"> and clip-path="url(#c)" are what design tools export and are fine.
 * SMIL animation elements are refused too: a logo never animates, and <set>/<animate> can retarget
 * href to a "javascript:" URL after the document has loaded.
 * The rules run on the raw text, on the text as the XML parser reads it (character references decoded once,
 * comments and processing instructions dropped, CDATA markers removed) and on that text as the CSS parser
 * reads it (backslash escapes decoded), with element and attribute names under any namespace prefix, so a
 * token hidden from one reading ("&#64;import", "\75rl(", "<svg:script>") is seen in another. What exists only
 * to make the readings differ (a DOCTYPE beyond the plain form, <!ENTITY>/<!ATTLIST>, an entity other than the five
 * XML predefines, the control characters that switch the byte encoding, xml:base, an element inside <style>) is
 * refused outright: a logo never needs it.
 * Returns null when the SVG is acceptable.
 */
export function svgLogoProblem(svg: string): "script" | "handler" | "external_ref" | null {
  // Control characters XML forbids (the NUL bytes of a UTF-16 file decoded as UTF-8, the ESC of an ISO-2022-JP
  // declaration) make the browser read bytes these rules cannot. A DOCTYPE internal subset declares entities and
  // attribute defaults the rules never see; the declarations themselves are refused in problemIn too, since the
  // subset can hide behind a system literal containing ">".
  if (/[^\t\n\r\x20-￿]|<!DOCTYPE[^<>[]*\[/i.test(svg)) return "script";
  // Only the five predefined entities: a DOCTYPE naming an XHTML or MathML DTD makes browsers decode every HTML
  // entity ("&bsol;" is "\", "&commat;" is "@"), which parsed() does not.
  if (/&(?!#|(?:amp|lt|gt|quot|apos);)/.test(svg)) return "script";
  // Only the plain DOCTYPE design tools write: a literal holding "<" or ">" can open a comment, processing
  // instruction or CDATA section that parsed() drops although the XML parser reads what follows as content.
  if (/<!DOCTYPE(?!\s+[\w:.-]+(?:\s+(?:PUBLIC\s+(?:"[^"<>]*"|'[^'<>]*')|SYSTEM)\s+(?:"[^"<>]*"|'[^'<>]*'))?\s*>)/i.test(svg)) return "script";
  const text = parsed(svg);
  // An element inside <style> splits its text and the browser joins the pieces back ("@imp<g/>ort"), so none is allowed.
  if (/<(?:[^\t\n\r <>/]*:)?style\b(?:[^<>"']|"[^"<]*"|'[^'<]*')*(?<!\/)>[^<]*<(?!\/)/i.test(text)) return "external_ref";
  return problemIn(svg) ?? problemIn(text) ?? problemIn(cssUnescaped(text));
}

const NAMED: Record<string, number> = { amp: 0x26, lt: 0x3c, gt: 0x3e, quot: 0x22, apos: 0x27 };

/** The text as the XML parser reads it: comments and processing instructions gone, CDATA markers gone, character references decoded once. */
function parsed(svg: string): string {
  return svg
    // CDATA content is character data, never markup, so its "<" cannot open a tag.
    .replace(/<!\[CDATA\[([\s\S]*?)(?:\]\]>|$)|<!--[\s\S]*?(?:-->|$)|<\?[\s\S]*?(?:\?>|$)/g, (_, cdata: string | undefined) => cdata?.replace(/</g, "&lt;") ?? "")
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (ref: string, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
      const code = name ? NAMED[name.toLowerCase()] : dec ? Number(dec) : parseInt(hex ?? "", 16);
      // A reference to < > " ' stays written as one: the parser never gives the decoded character markup meaning, these rules would.
      return code <= 0x10ffff && ![0x22, 0x27, 0x3c, 0x3e].includes(code) ? String.fromCodePoint(code) : ref;
    });
}

/**
 * The text as the CSS parser reads it: backslash escapes decoded ("\75rl(" is "url(", "@\69mport" is "@import").
 * Decoded over the whole file, since presentation attributes are CSS values too; where the browser would not
 * decode, this only refuses more.
 */
function cssUnescaped(text: string): string {
  return text.replace(/\\(?:([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([^\n\r\f]))/gi, (_, hex: string | undefined, char: string | undefined) => {
    if (char !== undefined) return char;
    const code = parseInt(hex ?? "", 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "�";
  });
}

// Element and attribute names may carry any namespace prefix ("<svg:script>", "l:href"): a prefix bound to the
// SVG or XLink namespace names the same thing, so every prefix is refused. Each prefix scan stops at the next
// delimiter, so no two scans cover the same text. The XHTML and MathML namespaces are refused wherever they are
// bound: an <img>, <meta refresh> or <base> in XHTML, or an <mglyph src> in MathML, is live even outside <foreignObject>.
// Whitespace here is XML's (tab, LF, CR, space): JavaScript's \s also matches U+1680 and U+FEFF, which XML allows
// inside a name, so a prefix made of them would hide the name behind it.
function problemIn(text: string): "script" | "handler" | "external_ref" | null {
  if (/<(?:[^\t\n\r <>/]*:)?(?:script|foreignObject|iframe|embed|object|set|animate|animateTransform|animateMotion|animateColor)\b|javascript:|vbscript:|<!(?:ENTITY|ATTLIST)|<\?xml-stylesheet|www\.w3\.org\/1999\/xhtml|www\.w3\.org\/1998\/Math\/MathML/i.test(text)) return "script";
  if (/(?:^|[\t\n\r "'/])(?:[^\t\n\r "'<>=/]+:)?on[a-z]+[\t\n\r ]*=/i.test(text)) return "handler";
  // Every href value under any prefix, and every url(...) in presentation attributes, style attributes and
  // <style> blocks, must point inside the document. Only the first character of the value is read: capturing
  // the value re-scans the rest of the file from every unclosed quote or "url(" (quadratic, minutes of blocked
  // server for a 512 KB logo), and a decoy attribute whose value contains a quote shifts where a capture starts.
  for (const m of text.matchAll(/(?:^|[\t\n\r "'/])(?:[^\t\n\r "'<>=/]+:)?href[\t\n\r ]*=[\t\n\r ]*["']?[\t\n\r ]*(#?)|url\([\t\n\r ]*["']?[\t\n\r ]*(#?)/gi)) {
    if (!(m[1] ?? m[2])) return "external_ref";
  }
  // image-set(), image() and src() also take a plain string URL, with no url( token to check.
  if (/@import\b|image(?:-set)?\(|src\(/i.test(text)) return "external_ref";
  // xml:base makes "#a" resolve against another document.
  if (/(?:^|[\t\n\r "'/])[^\t\n\r "'<>=/]+:base[\t\n\r ]*=/i.test(text)) return "external_ref";
  return null;
}
