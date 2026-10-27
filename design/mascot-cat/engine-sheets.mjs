// Contact sheets of the portal cat engine (the single source of truth) through renderAt (deterministic frames):
// one sheet per behaviour, one per mascot act (stage and square box), moods, gestures, close-ups, the rig
// parameters and sizes on light and dark.
// usage: node engine-sheets.mjs <outDir> [engine.js] [only-substring]   (needs playwright)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , outDir, enginePath = path.join(here, "../../portal/src/components/mascot/cat/engine.js"), only] = process.argv;
if (!outDir) { console.error("usage: node engine-sheets.mjs <outDir> [engine.js] [only]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const html = fs.readFileSync(path.join(here, "engine-sheets.html"));
// test hook for rig sheets: internal pose tables, appended to the served copy only (the product file is untouched)
const engine = fs.readFileSync(enginePath, "utf8") + `
export const __t = { BEH, P, at, PRESENT, STAND, LOAF };
`;

const MASCOT = ["present", "groom", "sleep", "wake", "yawn", "look", "pet", "knead", "flick", "jump"];
const ROAM = ["sit", "walk", "trot", "turn", "stretch", "chase", "sleep"];
// the mascot acts of 2026-10-27, each in a stage box and a square box (H.act)
const ACTS = ["sleep", "doze", "blink", "tilt", "stretch", "roll", "chase-tail", "pounce", "mouse", "yarn", "laser", "run"];
const problems = [];
const browser = await chromium.launch();
async function run(dpr, jobs) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[console] ${m.text().slice(0, 300)}`); });
  await page.route("http://cat.test/**", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith("engine.js")) return r.fulfill({ body: engine, contentType: "text/javascript" });
    return r.fulfill({ body: html, contentType: "text/html" });
  });
  await page.goto("http://cat.test/index.html");
  await page.waitForFunction(() => window.ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  for (const [file, expr] of jobs) {
    if (only && !file.includes(only)) continue;
    try {
      const t0 = Date.now();
      const url = await page.evaluate(expr);
      fs.writeFileSync(path.join(outDir, file), Buffer.from(url.split(",")[1], "base64"));
      console.log(`${file} ${Date.now() - t0} ms`);
    } catch (e) { problems.push(`[${file}] ${String(e).slice(0, 300)}`); }
  }
  await ctx.close();
}
const jobs2 = [
  ...MASCOT.map((b) => [`b-${b}.png`, `H.behaviour(${JSON.stringify(b)}, "mascot")`]),
  ...ROAM.map((b) => [`r-${b}.png`, `H.behaviour(${JSON.stringify(b)}, "roam")`]),
  ...ACTS.map((b) => [`a-${b}.png`, `H.act(${JSON.stringify(b)})`]),
  ["moods.png", "H.moods()"],
  ["rig.png", "H.rig()"],
  ["close2.png", `H.close([["present", 0.02, {gesture: "think", gt: 0.5}, "think"], ["present", 0.02, {gesture: "wave", gt: 0.5}, "wave"], ["present", 0.02, {mood: "celebrate"}, "celebrate"]], "close-ups 2")`],
  ["zoom.png", `H.close([["present", 0.02, {gesture: "think", gt: 0.5}, "think", 800]], "zoom")`],
  ["close.png", `H.close([["present", 0.02, {}, "idle"], ["sleep", 0.85, {}, "sleep"], ["yawn", 0.45, {}, "yawn"]])`],
  ["gestures.png", "H.gestures()"],
  ["sizes-light-dpr2.png", "H.sizes(false)"],
  ["sizes-dark-dpr2.png", "H.sizes(true)"],
];
await run(2, jobs2);
await run(1, [["sizes-light-dpr1.png", "H.sizes(false)"], ["sizes-dark-dpr1.png", "H.sizes(true)"]]);
await browser.close();
fs.writeFileSync(path.join(outDir, "problems.txt"), problems.join("\n"));
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "OK: no problems");
