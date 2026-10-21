// Deterministic and live screenshots of a cat mascot page through its window.cat API.
// usage: node cat-shoot.mjs <path-to-html> <out-dir>
// Needs: window.cat.behaviours (string[]), window.cat.moods (string[]),
//        window.cat.renderAt(name, t, opts?) freezing a frame, window.cat.resume(), #stage, #sizes.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , htmlPath, outDir] = process.argv;
if (!htmlPath || !outDir) {
  console.error("usage: node cat-shoot.mjs <html> <outDir>");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const url = "file:///" + path.resolve(htmlPath).replace(/\\/g, "/");
const browser = await chromium.launch();
const problems = [];
const watch = (page, tag) => {
  page.on("pageerror", (e) => problems.push(`[pageerror ${tag}] ${e.message.slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[console ${tag}] ${m.text().slice(0, 200)}`); });
};

// 1) Deterministic frames of every behaviour and mood.
const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
watch(page, "frames");
await page.goto(url);
await page.waitForTimeout(600);
const meta = await page.evaluate(() => ({
  ok: typeof window.cat === "object" && !!window.cat,
  behaviours: Array.isArray(window.cat?.behaviours) ? window.cat.behaviours : [],
  moods: Array.isArray(window.cat?.moods) ? window.cat.moods : [],
  renderAt: typeof window.cat?.renderAt === "function",
}));
if (!meta.ok) problems.push("[api] window.cat missing");
if (!meta.renderAt) problems.push("[api] cat.renderAt missing");
if (!meta.behaviours.length) problems.push("[api] cat.behaviours empty");
const stage = page.locator("#stage");
if (!(await stage.count())) problems.push("[stage] #stage missing");
const T = [0.12, 0.37, 0.62, 0.87];
const shots = [];
for (const b of meta.behaviours) {
  for (const t of T) {
    try {
      await page.evaluate(([b, t]) => window.cat.renderAt(b, t), [b, t]);
      await page.waitForTimeout(50);
      const f = `b-${b}-${String(t).slice(2)}.png`;
      await stage.screenshot({ path: path.join(outDir, f) });
      shots.push({ group: "behaviours", label: `${b} @${t}`, f });
    } catch (e) { problems.push(`[renderAt ${b} ${t}] ${String(e).slice(0, 160)}`); }
  }
}
for (const m of meta.moods) {
  try {
    await page.evaluate((m) => window.cat.renderAt("sit", 0.5, { mood: m }), m);
    await page.waitForTimeout(50);
    const f = `m-${m}.png`;
    await stage.screenshot({ path: path.join(outDir, f) });
    shots.push({ group: "moods", label: m, f });
  } catch (e) { problems.push(`[mood ${m}] ${String(e).slice(0, 160)}`); }
}
try {
  await page.evaluate(() => window.cat.renderAt("sit", 0.5, { mood: "talk", talking: true }));
  await page.waitForTimeout(50);
  await stage.screenshot({ path: path.join(outDir, "m-talking.png") });
  shots.push({ group: "moods", label: "talking", f: "m-talking.png" });
} catch (e) { problems.push(`[talking] ${String(e).slice(0, 160)}`); }

// 2) Live: autonomous life, then a pointer chase.
await page.evaluate(() => window.cat.resume && window.cat.resume());
await page.waitForTimeout(2500);
await stage.screenshot({ path: path.join(outDir, "live-1-auto.png") });
const box = await stage.boundingBox();
if (box) {
  for (let i = 0; i <= 40; i++) {
    const x = box.x + box.width * (0.15 + 0.7 * Math.abs(Math.sin(i / 6)));
    const y = box.y + box.height * (0.55 + 0.25 * Math.sin(i / 4));
    await page.mouse.move(x, y, { steps: 3 });
    await page.waitForTimeout(40);
    if (i === 20) await stage.screenshot({ path: path.join(outDir, "live-2-chase.png") });
  }
  await page.waitForTimeout(500);
  await stage.screenshot({ path: path.join(outDir, "live-3-after-chase.png") });
}
for (const s of ["live-1-auto.png", "live-2-chase.png", "live-3-after-chase.png"]) shots.push({ group: "live", label: s.replace(".png", ""), f: s });
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
if (sw > 1100) problems.push(`[overflow desktop] scrollWidth ${sw}`);
await ctx.close();

// 3) Page in both themes, sizes row, phone width, reduced motion.
for (const scheme of ["light", "dark"]) {
  const c = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: scheme });
  const p = await c.newPage();
  watch(p, `page-${scheme}`);
  await p.goto(url);
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(outDir, `page-${scheme}.png`), fullPage: true });
  const sizes = p.locator("#sizes");
  if (await sizes.count()) await sizes.screenshot({ path: path.join(outDir, `sizes-${scheme}.png`) });
  else problems.push(`[sizes ${scheme}] #sizes missing`);
  await c.close();
}
{
  const c = await browser.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
  const p = await c.newPage();
  watch(p, "phone");
  await p.goto(url);
  await p.waitForTimeout(600);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  if (w > 390) problems.push(`[overflow phone] scrollWidth ${w} > 390`);
  await p.screenshot({ path: path.join(outDir, "phone.png"), fullPage: true });
  await c.close();
}
{
  const c = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: "reduce" });
  const p = await c.newPage();
  watch(p, "reduced");
  await p.goto(url);
  await p.waitForTimeout(1500);
  const still = await p.evaluate(() => (typeof window.cat?.isStill === "function" ? window.cat.isStill() : null));
  if (still !== true) problems.push(`[reduced-motion] cat.isStill() returned ${still}, expected true`);
  await c.close();
}

// 4) Contact sheets (one per group) so a reviewer opens three images instead of dozens.
const groups = [...new Set(shots.map((s) => s.group))];
const sc = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const sp = await sc.newPage();
for (const g of groups) {
  const items = shots.filter((s) => s.group === g);
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f7f6fb;font:600 14px system-ui;color:#16123a}
  .g{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%;border-radius:10px;border:1px solid #ddd}</style>
  <h2 style="margin:0 0 12px">${g}</h2><div class="g">${items.map((s) => `<figure><img src="${s.f}"><figcaption>${s.label}</figcaption></figure>`).join("")}</div>`;
  const sheet = path.join(outDir, `_sheet-${g}.html`);
  fs.writeFileSync(sheet, html);
  await sp.goto("file:///" + path.resolve(sheet).replace(/\\/g, "/"));
  await sp.waitForTimeout(300);
  await sp.screenshot({ path: path.join(outDir, `sheet-${g}.png`), fullPage: true });
}
await browser.close();
fs.writeFileSync(path.join(outDir, "problems.txt"), problems.join("\n"));
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "OK: no problems");
console.log(`sheets: ${groups.map((g) => `sheet-${g}.png`).join(", ")} in ${outDir}`);
