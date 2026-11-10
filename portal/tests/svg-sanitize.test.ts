import { describe, expect, it } from "vitest";
import { svgLogoProblem } from "../src/server/svg-safety";

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">${inner}</svg>`;

describe("svgLogoProblem", () => {
  it("accepts internal references as design tools export them", () => {
    expect(svgLogoProblem(wrap('<defs><linearGradient id="g1"/></defs><rect fill="url(#g1)" width="10" height="10"/>'))).toBeNull();
    expect(svgLogoProblem(wrap('<defs><path id="a" d="M0 0h1"/></defs><use href="#a"/>'))).toBeNull();
    expect(svgLogoProblem(wrap("<use xlink:href='#a'/>"))).toBeNull();
    expect(svgLogoProblem(wrap('<linearGradient id="b" xlink:href="#g1"/><g clip-path="url( \'#c\' )"/>'))).toBeNull();
    expect(svgLogoProblem(wrap('<use href=#a />'))).toBeNull();
    expect(svgLogoProblem(wrap('<text font-family="Montserrat" stroke-linejoin="round" baseline-shift="1">Logo</text>'))).toBeNull();
  });

  it("refuses external and script references", () => {
    expect(svgLogoProblem(wrap('<image href="https://evil.example/x.png"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<use xlink:href="other.svg#a"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<a href="javascript:alert(1)"><rect/></a>'))).toBe("script");
    expect(svgLogoProblem(wrap('<rect style="fill:url(https://evil.example/f)"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>@import "https://evil.example/a.css";</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<image href="data:image/png;base64,AAAA"/>'))).toBe("external_ref");
  });

  it("refuses scripts, handlers and foreign objects", () => {
    expect(svgLogoProblem(wrap("<script>alert(1)</script>"))).toBe("script");
    expect(svgLogoProblem(wrap('<rect onload="alert(1)"/>'))).toBe("handler");
    expect(svgLogoProblem(wrap('<rect x="1"onclick="alert(1)"/>'))).toBe("handler");
    expect(svgLogoProblem(wrap("<foreignObject><div/></foreignObject>"))).toBe("script");
  });

  it("refuses SMIL animation, which can retarget href to an entity-encoded javascript: URL", () => {
    expect(svgLogoProblem(wrap('<a><set attributeName="href" to="javascript&#58;alert(1)"/><text>x</text></a>'))).toBe("script");
    expect(svgLogoProblem(wrap('<a><animate attributeName="href" values="&#106;avascript:alert(1)"/><text>x</text></a>'))).toBe("script");
    expect(svgLogoProblem(wrap('<rect><animateTransform attributeName="transform" type="rotate" to="360"/></rect>'))).toBe("script");
    expect(svgLogoProblem(wrap('<rect><animateMotion path="M0 0h1"/></rect>'))).toBe("script");
  });

  it("refuses the same elements and attributes under any namespace prefix (P1, P2)", () => {
    expect(svgLogoProblem(wrap("<svg:script>alert(1)</svg:script>"))).toBe("script");
    expect(svgLogoProblem(wrap("<x:SCRIPT xmlns:x='http://www.w3.org/2000/svg'/>"))).toBe("script");
    expect(svgLogoProblem(wrap("<h:iframe xmlns:h='http://www.w3.org/1999/xhtml'/>"))).toBe("script");
    // Any element in the XHTML namespace is a real HTML element, so the namespace itself is refused.
    expect(svgLogoProblem(wrap('<h:img xmlns:h="http://www.w3.org/1999/xhtml" src="https://evil.example/x.png"/>'))).toBe("script");
    expect(svgLogoProblem(wrap('<meta xmlns="http://www.w3.org/1999/&#120;html" http-equiv="refresh" content="0;url=https://evil.example"/>'))).toBe("script");
    // MathML is refused the same way: <mglyph src> loads an image by URL.
    expect(svgLogoProblem(wrap('<m:math xmlns:m="http://www.w3.org/1998/Math/MathML"><m:mglyph src="https://evil.example/x.png"/></m:math>'))).toBe("script");
    expect(svgLogoProblem(wrap('<a><svg:set attributeName="href" to="javascript:alert(1)"/></a>'))).toBe("script");
    expect(svgLogoProblem(wrap('<image svg:href="https://evil.example/x.png"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<use l:href="other.svg#a" xmlns:l="http://www.w3.org/1999/xlink"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<rect svg:onload="alert(1)"/>'))).toBe("handler");
    expect(svgLogoProblem(wrap('<use a:l:href="other.svg#a"/>'))).toBe("external_ref");
    // U+1680 and U+FEFF are whitespace to JavaScript but name characters to XML, so they can form a prefix.
    expect(svgLogoProblem('<svg xmlns="http://www.w3.org/2000/svg" xmlns: ="http://www.w3.org/2000/svg">< :script>alert(1)</ :script></svg>')).toBe("script");
    expect(svgLogoProblem('<svg xmlns="http://www.w3.org/2000/svg" xmlns:a﻿="http://www.w3.org/1999/xlink"><image a﻿:href="https://evil.example/x.png"/></svg>')).toBe("external_ref");
    expect(svgLogoProblem(wrap('<rect  :onload="alert(1)"/>'))).toBe("handler");
    expect(svgLogoProblem(wrap('<g  :base="https://evil.example/"><use href="#a"/></g>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap("< :style>@imp<g/>ort 'https://evil.example/a.css';</ :style>"))).toBe("external_ref");
    // A decoy attribute whose value holds a quote must not shift where the href value is read.
    expect(svgLogoProblem(wrap(`<image x='href="#' href="https://evil.example/x.png"/>`))).toBe("external_ref");
    // Prefixed names that are not refused elements, and a prefixed internal reference, stay accepted.
    expect(svgLogoProblem(wrap('<sodipodi:namedview inkscape:zoom="1"/><svg:settings/><use l:href="#a"/>'))).toBeNull();
  });

  it("judges character references by what they decode to, decoding once as the parser does (P3)", () => {
    expect(svgLogoProblem(wrap('<rect style="fill:&#117;rl(https://evil.example/f)"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>&#x40;import "https://evil.example/a.css";</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>@&#0105;mpor&#X74; "https://evil.example/a.css";</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<a href="java&#9;script:alert(1)"><rect/></a>'))).toBe("external_ref");
    // An XHTML or MathML public id makes browsers decode HTML named entities, so only the five XML predefines are accepted.
    expect(svgLogoProblem(`<!DOCTYPE svg PUBLIC "-//W3C//DTD XHTML 1.1 plus MathML 2.0 plus SVG 1.1//EN" "http://www.w3.org/2002/04/xhtml-math-svg/xhtml-math-svg.dtd">${wrap('<rect style="fill:&bsol;75rl(https://evil.example/f)"/>')}`)).toBe("script");
    expect(svgLogoProblem(`<!DOCTYPE svg PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "x.dtd">${wrap('<style>&commat;import "https://evil.example/a.css";</style>')}`)).toBe("script");
    expect(svgLogoProblem(wrap("<text>a&nbsp;b &AMP;</text>"))).toBe("script");
    // "&amp;#117;" is the text "&#117;" after the parser's single decoding, not "u".
    expect(svgLogoProblem(wrap('<rect style="fill:&amp;#117;rl(https://evil.example/f)"/>'))).toBeNull();
    expect(svgLogoProblem(wrap("<text>Tom &amp; Jerry &lt; 3 &#169; &#x2014;</text>"))).toBeNull();
  });

  it("refuses a DOCTYPE beyond the plain form and keeps the one design tools write (P4, P5, P6)", () => {
    const plain = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n';
    expect(svgLogoProblem(`${plain}${wrap("<title>Logo</title><desc>d</desc><metadata><rdf:RDF/></metadata><rect/>")}`)).toBeNull();
    expect(svgLogoProblem(`<!DOCTYPE svg [<!ATTLIST rect onload CDATA "alert(1)">]>${wrap("<rect/>")}`)).toBe("script");
    expect(svgLogoProblem(`<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [ <!ENTITY x "y"> ]>${wrap("<rect/>")}`)).toBe("script");
    // A system literal may contain ">" or "<", which hides the "[" from the DOCTYPE scan: the declarations are refused on their own.
    expect(svgLogoProblem(`<!DOCTYPE svg SYSTEM "x>y" [<!ATTLIST rect onload CDATA "alert(1)">]>${wrap("<rect/>")}`)).toBe("script");
    expect(svgLogoProblem(`<!DOCTYPE svg SYSTEM "x<y" [<!ATTLIST use xlink:href CDATA "https://evil.example/x">]>${wrap("<use/>")}`)).toBe("script");
    // A literal that opens a comment, processing instruction or CDATA section would hide live content from the parsed reading.
    expect(svgLogoProblem(`<!DOCTYPE svg SYSTEM "<!--">${wrap("<style>&#64;import 'https://evil.example/a.css';</style><!-- -->")}`)).toBe("script");
    expect(svgLogoProblem(`<!DOCTYPE svg SYSTEM "<?x">${wrap('<rect style="fill:&#117;rl(https://evil.example/f)"/><?x ?>')}`)).toBe("script");
    expect(svgLogoProblem(`<!DOCTYPE svg SYSTEM 'a>b<!--'>${wrap("<style>&#64;import 'https://evil.example/a.css';</style><!-- -->")}`)).toBe("script");
    expect(svgLogoProblem(`<!DOCTYPE svg SYSTEM "<![CDATA[">${wrap('<rect style="fill:&#117;rl(https://evil.example/f)"/>')}`)).toBe("script");
    // Single-quoted literals (SVG 1.0 exports) and a bare DOCTYPE stay accepted.
    expect(svgLogoProblem(`<!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.0//EN' 'http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd'>${wrap("<rect/>")}`)).toBeNull();
    expect(svgLogoProblem(`<!DOCTYPE svg>${wrap("<rect/>")}`)).toBeNull();
  });

  it("sees tokens the parser assembles across comments, CDATA sections and processing instructions (P5)", () => {
    expect(svgLogoProblem(wrap('<style>@imp<![CDATA[ort]]> "https://evil.example/a.css";</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>@imp<!-- -->ort "https://evil.example/a.css";</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>@imp<?x?>ort "https://evil.example/a.css";</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap("<style>.a{fill:u<![CDATA[rl(]]>https://evil.example/f)}</style>"))).toBe("external_ref");
    // An element inside <style> splits the text the browser joins back, whatever the start tag's attributes hold.
    expect(svgLogoProblem(wrap("<style>@imp<g/>ort 'https://evil.example/a.css';</style>"))).toBe("external_ref");
    expect(svgLogoProblem(wrap("<style>.a{fill:u<g/>rl(https://evil.example/f)}</style>"))).toBe("external_ref");
    expect(svgLogoProblem(wrap("<style>@imp<title>x</title>ort 'https://evil.example/a.css';</style>"))).toBe("external_ref");
    expect(svgLogoProblem(wrap(`<style title="/>">@imp<g/>ort 'https://evil.example/a.css';</style>`))).toBe("external_ref");
    expect(svgLogoProblem(wrap(`<style title=">">@imp<g/>ort 'https://evil.example/a.css';</style>`))).toBe("external_ref");
    expect(svgLogoProblem(wrap("<svg:style>@imp<g/>ort 'https://evil.example/a.css';</svg:style>"))).toBe("external_ref");
    expect(svgLogoProblem(wrap("<style\n type='text/css'\n>@imp<g/>ort 'https://evil.example/a.css';</style>"))).toBe("external_ref");
    // Self-closing and consecutive style elements, ">" in selectors, a fake end inside CDATA, a comment inside and look-alike names stay accepted.
    expect(svgLogoProblem(wrap('<style>.a{fill:#fff}</style><rect class="a"/><style>.b{}</style><g/>'))).toBeNull();
    expect(svgLogoProblem(wrap('<style id="s1"/><rect/><svg:style /><g/>'))).toBeNull();
    expect(svgLogoProblem(wrap("<style>svg > g{fill:red} a>b{}</style><rect/>"))).toBeNull();
    expect(svgLogoProblem(wrap("<style><![CDATA[</style>]]>.a{}</style><rect/>"))).toBeNull();
    expect(svgLogoProblem(wrap("<style><!-- .a{} -->.b{}</style><rect/>"))).toBeNull();
    expect(svgLogoProblem(wrap("<styles/><stylesheet>x<g/></stylesheet>"))).toBeNull();
    // Illustrator wraps its CSS in CDATA and writes a generator comment.
    expect(svgLogoProblem(`<!-- Generator: Adobe Illustrator -->${wrap('<style type="text/css"><![CDATA[.st0{fill:#FFF;}]]></style><rect class="st0"/>')}`)).toBeNull();
  });

  it("refuses xml:base, CSS escapes in styles and a UTF-16 file decoded as UTF-8 (P5)", () => {
    expect(svgLogoProblem(wrap('<g xml:base="https://evil.example/"><use href="#a"/></g>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<rect style="fill:\\75rl(https://evil.example/f)"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>@\\69mport "https://evil.example/a.css";</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap("<rect style='fill:\\75rl(https://evil.example/f)'/>"))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<STYLE>@\\49MPORT "https://evil.example/a.css";</STYLE>'))).toBe("external_ref");
    // The style element under a prefix, a presentation attribute (a CSS value too) and a decoy attribute before the style attribute.
    expect(svgLogoProblem(wrap('<svg:style>@\\69mport "https://evil.example/a.css";</svg:style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<s:style xmlns:s="http://www.w3.org/2000/svg">.a{fill:\\75rl(https://evil.example/f)}</s:style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<rect fill="\\75rl(https://evil.example/f)"/>'))).toBe("external_ref");
    // image-set(), image() and src() take a plain string URL, escaped or not.
    expect(svgLogoProblem(wrap(`<rect style="fill:image-set('https://evil.example/f.png' 1x)"/>`))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>.a{background:\\69mage-set("https://evil.example/f.png" 1x)}</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap(`<rect style="fill:image('https://evil.example/f.png')"/>`))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>.a{background:src("https://evil.example/f.png")}</style>'))).toBe("external_ref");
    // Only XML and CSS whitespace is skipped before the "#": the URL parser keeps U+1680 or U+00A0, so the reference leaves the file.
    expect(svgLogoProblem(wrap('<use href=" #a"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<rect fill="url( #a)"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap(`<use href=" #a"/><rect fill="url( #g)" style="fill:url(\t'#g')"/>`))).toBeNull();
    expect(svgLogoProblem(wrap('<rect x="style=" style="fill:\\75rl(https://evil.example/f)"/>'))).toBe("external_ref");
    // Decoded &quot; or a fake "</style" (from &lt; or a CDATA section) must not end the style text before the escape.
    expect(svgLogoProblem(wrap('<rect style="&quot;&quot;;fill:&#92;75rl(https://evil.example/f)"/>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style>&lt;/style&gt;{}.a{fill:&#92;75rl(https://evil.example/f)}</style>'))).toBe("external_ref");
    expect(svgLogoProblem(wrap('<style><![CDATA[</style>]]>{}.a{fill:\\75rl(https://evil.example/f)}</style>'))).toBe("external_ref");
    expect(svgLogoProblem(Buffer.from(`\uFEFF${wrap("<script>alert(1)</script>")}`, "utf16le").toString("utf8"))).toBe("script");
    // ISO-2022-JP named in the XML declaration: its decoder swallows "ESC ( B", so the browser reads <script>.
    expect(svgLogoProblem(`<?xml version="1.0" encoding="iso-2022-jp"?>${wrap("<scr\x1b(Bipt>alert(1)</scr\x1b(Bipt>")}`)).toBe("script");
    // A UTF-8 BOM, a backslash outside styles, "-base" without a prefix and escaped markup characters in text are fine.
    expect(svgLogoProblem(`\uFEFF${wrap('<rect data-base="x" inkscape:export-filename="C:\\logo.png"/>')}`)).toBeNull();
    expect(svgLogoProblem(wrap("<text>&lt;b&gt; &quot;q&quot; &apos;s&apos;</text>"))).toBeNull();
  });

  it("keeps names that only start with a refused name (P6)", () => {
    expect(svgLogoProblem(wrap("<settings/><animateFoo/><setup-like/><objective/><embedded/>"))).toBeNull();
  });
});
