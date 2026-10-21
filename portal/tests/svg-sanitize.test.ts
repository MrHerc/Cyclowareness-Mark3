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
});
