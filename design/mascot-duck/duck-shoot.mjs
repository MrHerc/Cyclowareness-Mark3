// Screenshots a duck mascot page through its window.duck API.
// usage: node duck-shoot.mjs <path-to-html> <out-dir>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , htmlPath, outDir] = process.argv;
if (!htmlPath || !outDir) {
  console.error("usage: node duck-shoot.mjs <html> <outDir>");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const url = "file:///" + path.resolve(htmlPath).replace(/\\/g, "/");
const browser = await chromium.launch();
const problems = [];

async function shoot(colorScheme, name, prepare) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 760 }, colorScheme, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[pageerror ${name}] ${e.message.slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[console ${name}] ${m.text().slice(0, 200)}`); });
  await page.goto(url);
  await page.waitForTimeout(400);
  const hasApi = await page.evaluate(() => typeof window.duck === "object" && window.duck !== null);
  if (!hasApi) problems.push(`[api ${name}] window.duck missing`);
  try { await prepare(page); } catch (e) { problems.push(`[prepare ${name}] ${String(e).slice(0, 200)}`); }
  const stage = page.locator("#stage");
  if (await stage.count()) await stage.screenshot({ path: path.join(outDir, `${name}.png`) });
  else { problems.push(`[stage ${name}] #stage missing`); await page.screenshot({ path: path.join(outDir, `${name}.png`) }); }
  await ctx.close();
}

const api = (code) => async (page) => { await page.evaluate(code); };
await shoot("light", "01-idle-light", api("duck.setMood('idle')"));
await shoot("dark", "02-idle-dark", api("duck.setMood('idle')"));
await shoot("light", "03-talk", async (p) => { await p.evaluate("duck.setMood('talk'); duck.setTalking(true)"); await p.waitForTimeout(180); });
await shoot("light", "04-happy", api("duck.setMood('happy')"));
await shoot("light", "05-think", api("duck.setMood('think')"));
await shoot("light", "06-alert", api("duck.setMood('alert')"));
await shoot("light", "07-celebrate", async (p) => { await p.evaluate("duck.setMood('celebrate'); duck.play('cheer')"); await p.waitForTimeout(350); });
await shoot("light", "08-wave-mid", async (p) => { await p.evaluate("duck.setMood('happy'); duck.play('wave')"); await p.waitForTimeout(350); });
await shoot("light", "09-poke-mid", async (p) => { await p.evaluate("duck.poke()"); await p.waitForTimeout(160); });
await shoot("light", "10-look-left-up", api("duck.lookAt(0.05, 0.1)"));
await shoot("light", "11-look-right-down", api("duck.lookAt(0.95, 0.9)"));
await shoot("light", "12-sad", api("duck.setMood('sad')"));
await shoot("light", "13-surprised", api("duck.setMood('surprised')"));

// The whole page (controls + small sizes) in both themes.
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[pageerror page-${scheme}] ${e.message.slice(0, 200)}`));
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `20-page-${scheme}.png`), fullPage: true });
  const sizes = page.locator("#sizes");
  if (await sizes.count()) await sizes.screenshot({ path: path.join(outDir, `21-sizes-${scheme}.png`) });
  else problems.push(`[sizes page-${scheme}] #sizes missing`);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > 1200) problems.push(`[overflow page-${scheme}] scrollWidth ${w} > 1200`);
  await ctx.close();
}
// Phone width overflow check.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(300);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > 390) problems.push(`[overflow phone] scrollWidth ${w} > 390`);
  await page.screenshot({ path: path.join(outDir, `22-phone.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "problems.txt"), problems.join("\n"));
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "OK: no problems");
console.log("shots in", outDir);
