import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { DB } from "@/server/db/client";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

const h = vi.hoisted(() => ({ db: null as unknown as DB, player: { js: Buffer.from(""), css: Buffer.from("") }, features: new Set(["studio"]) as Set<string>, viewer: null as unknown }));
vi.mock("../src/server/db", async () => ({ db: () => h.db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/auth/api", () => ({ apiViewer: async () => h.viewer }));
vi.mock("../src/server/scorm/player", () => ({ scormPlayer: async () => h.player }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));

const { buildScormPlayer } = await import("../scripts/build-scorm-player");
const { scormData, scormFiles } = await import("@/server/scorm/package");
const { zip } = await import("@/server/zip");
const route = await import("../src/app/api/admin/modules/[id]/scorm/route");

const { db, ready } = testDb();
h.db = db;

/** Reads a zip written by src/server/zip.ts back into its files, in their order. */
function unzip(buf: Buffer): Map<string, Buffer> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const files = new Map<string, Buffer>();
  let p = buf.readUInt32LE(end + 16);
  for (let i = 0; i < buf.readUInt16LE(end + 10); i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    files.set(buf.subarray(p + 46, p + 46 + nameLen).toString("utf8"), inflateRawSync(buf.subarray(start, start + buf.readUInt32LE(p + 20))));
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return files;
}

/** The SCORM 1.2 content packaging rules a manifest must meet (IMS CP 1.1.2 + ADL SCORM 1.2 CAM), against the zip's files. */
function checkManifest(xml: string, files: Map<string, Buffer>, scored: boolean) {
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  // Well-formed: every element closes in order.
  const stack: string[] = [];
  for (const [, close, name, selfClosing] of xml.replace(/<\?xml[^>]*\?>/, "").matchAll(/<(\/?)([A-Za-z:]+)[^>]*?(\/?)>/g)) {
    if (close) expect(stack.pop()).toBe(name);
    else if (!selfClosing) stack.push(name);
  }
  expect(stack).toEqual([]);
  expect(xml).toMatch(/<manifest identifier="[A-Za-z_][\w.-]*" version="1\.0" xmlns="http:\/\/www\.imsproject\.org\/xsd\/imscp_rootv1p1p2" xmlns:adlcp="http:\/\/www\.adlnet\.org\/xsd\/adlcp_rootv1p2">/);
  expect(xml).toMatch(/<metadata>\s*<schema>ADL SCORM<\/schema>\s*<schemaversion>1\.2<\/schemaversion>\s*<\/metadata>/);
  const ids = [...xml.matchAll(/ identifier="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  ids.forEach((id) => expect(id).toMatch(/^[A-Za-z_][\w.-]*$/));
  // One organization, the default, with one titled SCO item pointing at an existing resource.
  const orgs = [...xml.matchAll(/<organization identifier="([^"]+)">\s*<title>[^<]+<\/title>/g)];
  expect(orgs).toHaveLength(1);
  expect(xml).toContain(`<organizations default="${orgs[0][1]}">`);
  const items = [...xml.matchAll(/<item identifier="[^"]+" identifierref="([^"]+)" isvisible="true">\s*<title>[^<]+<\/title>/g)];
  expect(items).toHaveLength(1);
  const resource = new RegExp(`<resource identifier="${items[0][1]}" type="webcontent" adlcp:scormtype="sco" href="([^"]+)">`).exec(xml);
  expect(resource).not.toBeNull();
  expect(files.has(resource![1])).toBe(true);
  // Every listed file is in the zip and every file of the zip but the manifest is listed.
  const listed = [...xml.matchAll(/<file href="([^"]+)"\/>/g)].map((m) => m[1]);
  expect(listed.sort()).toEqual([...files.keys()].filter((f) => f !== "imsmanifest.xml").sort());
  const mastery = /<adlcp:masteryscore>(\d+)<\/adlcp:masteryscore>/.exec(xml);
  if (scored) expect(Number(mastery?.[1])).toBeGreaterThanOrEqual(0);
  else expect(mastery).toBeNull();
  if (mastery) expect(Number(mastery[1])).toBeLessThanOrEqual(100);
}

let tenantId: string;
let moduleId: string;
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-player-"));

beforeAll(async () => {
  await ready();
  const tenant = await addTenant(db);
  tenantId = tenant.id;
  const user = await addUser(db, tenantId, { role: "content_creator" });
  h.viewer = { user: { id: user.id }, tenant: { id: tenantId, features: h.features } };
  const mod = await addModule(db, { lessons: 2 });
  moduleId = mod.id;
  // The first lesson also has an Azerbaijani text; the second has only English.
  await db.insert(schema.lessonContents).values({ lessonId: mod.lessons[0].id, locale: "az", scenes: [{ type: "intro", id: "start", title: "Başla", body: "Xoş gəldiniz." }] });
  await buildScormPlayer(outDir);
  h.player = { js: fs.readFileSync(path.join(outDir, "player.js")), css: fs.readFileSync(path.join(outDir, "player.css")) };
}, DB_SETUP_TIMEOUT);

describe("SCORM 1.2 package", () => {
  it("carries every lesson in the chosen language, English where it has none", async () => {
    const data = (await scormData(db, tenantId, moduleId, "az"))!;
    expect(data.locale).toBe("az");
    expect(data.module.title).toMatch(/^Modul \d+$/);
    expect(data.lessons.map((l) => [l.key, l.contentLocale])).toEqual([
      ["lesson-1", "az"],
      ["lesson-2", "en"],
    ]);
    expect(data.lessons[0].scenes).toHaveLength(1);
    expect(Object.keys(data.messages).sort()).toEqual(["common", "learner", "player"]);
  });

  it("refuses a module of another organisation", async () => {
    const other = await addTenant(db);
    const theirs = await addModule(db, { tenantId: other.id, lessons: 1 });
    expect(await scormData(db, tenantId, theirs.id, "en")).toBeNull();
    expect(await scormData(db, other.id, theirs.id, "en")).not.toBeNull();
  });

  it("zips a valid manifest, the launcher, the lessons and the offline player", async () => {
    const data = (await scormData(db, tenantId, moduleId, "en"))!;
    const files = unzip(zip(scormFiles(data, h.player)));
    expect([...files.keys()]).toEqual(["imsmanifest.xml", "launcher.html", "lessons.js", "player.js", "player.css"]);
    checkManifest(files.get("imsmanifest.xml")!.toString("utf8"), files, true);

    // Self-contained: the launcher loads only the package's own files, by relative paths.
    const launcher = files.get("launcher.html")!.toString("utf8");
    const refs = [...launcher.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(refs.sort()).toEqual(["lessons.js", "player.css", "player.js"]);
    expect(launcher).not.toMatch(/https?:|="\//);
    const lessons = files.get("lessons.js")!.toString("utf8");
    expect(lessons.startsWith("window.CYCLOWARENESS_SCORM = ")).toBe(true);
    expect(JSON.parse(lessons.slice(lessons.indexOf("=") + 1).trim().replace(/;$/, ""))).toEqual(data);

    // The real bundle: one script with the player and no server code; the app's CSS.
    const js = files.get("player.js")!.toString("utf8");
    expect(js.length).toBeGreaterThan(100_000);
    expect(js).toContain("CYCLOWARENESS_SCORM");
    expect(js).toContain("LMSSetValue");
    expect(js).toContain("No server in the SCORM package");
    expect(js).not.toMatch(/drizzle|pglite|"node:[a-z]+"/i);
    expect(js).not.toMatch(/^\s*(import|export)\s/m);
    expect(files.get("player.css")!.toString("utf8")).toContain("--color-ink");
  }, 60_000);

  it("leaves out the mastery score when no scene is scored", async () => {
    const data = (await scormData(db, tenantId, moduleId, "en"))!;
    const plain = { ...data, lessons: data.lessons.map((l) => ({ ...l, scenes: l.scenes.filter((s) => s.type === "intro" || s.type === "recap") })) };
    const files = unzip(zip(scormFiles(plain, h.player)));
    checkManifest(files.get("imsmanifest.xml")!.toString("utf8"), files, false);
  });
});

describe("SCORM export route", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const get = (id: string, locale = "ru") => route.GET(new Request(`http://localhost:3000/api/admin/modules/${id}/scorm?locale=${locale}`), ctx(id));

  it("streams the zip and audits the export", async () => {
    const res = await get(moduleId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="module-\d+-scorm12-ru\.zip"$/);
    const files = unzip(Buffer.from(await res.arrayBuffer()));
    expect(files.has("imsmanifest.xml")).toBe(true);
    const [entry] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "module.exported"));
    expect(entry).toMatchObject({ tenantId, targetType: "module", targetId: moduleId, meta: { format: "scorm12", locale: "ru" } });
  });

  it("refuses an unknown language, an unknown module and a plan without the studio", async () => {
    expect((await get(moduleId, "xx")).status).toBe(400);
    expect((await get("00000000-0000-4000-8000-000000000001")).status).toBe(404);
    expect((await get("not-a-uuid")).status).toBe(404);
    h.features.delete("studio");
    expect((await get(moduleId)).status).toBe(404);
    h.features.add("studio");
  });
});
