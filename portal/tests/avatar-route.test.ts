import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
let viewer: { tenant: { id: string } } | null = null;
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => viewer }));

const { GET } = await import("../src/app/api/avatar/[userId]/route");
const { avatarSrc, avatarSrcIn } = await import("../src/server/avatar");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const get = (userId: string) => GET(new Request(`http://localhost/api/avatar/${userId}`), { params: Promise.resolve({ userId }) });
let mine = "";
let bare = "";
let theirs = "";
let tenantId = "";

beforeAll(async () => {
  await ready();
  const [a, b] = [await addTenant(db), await addTenant(db)];
  tenantId = a.id;
  const photo = `data:image/png;base64,${PNG.toString("base64")}`;
  mine = (await addUser(db, a.id, { avatarUrl: photo })).id;
  bare = (await addUser(db, a.id)).id;
  theirs = (await addUser(db, b.id, { avatarUrl: photo })).id;
}, DB_SETUP_TIMEOUT);

describe("avatar route", () => {
  it("answers the photo's bytes to a viewer of the same organisation, privately cached", async () => {
    viewer = { tenant: { id: tenantId } };
    const res = await get(mine);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
  });

  it("answers 404 for another organisation's person, someone without a photo, a junk id and a signed-out request", async () => {
    viewer = { tenant: { id: tenantId } };
    for (const id of [theirs, bare, "x"]) expect((await get(id)).status).toBe(404);
    viewer = null;
    expect((await get(mine)).status).toBe(404);
  });

  it("gives pages an address that changes with the photo, never the base64", async () => {
    const src = async (id: string) => (await db.select({ src: avatarSrc }).from(t.users).where(eq(t.users.id, id)))[0].src;
    const before = await src(mine);
    expect(before).toMatch(new RegExp(`^/api/avatar/${mine}\\?v=[0-9a-f]{8}$`));
    expect(await src(bare)).toBeNull();
    await db.update(t.users).set({ avatarUrl: "data:image/png;base64,AAAA" }).where(eq(t.users.id, mine));
    expect(await src(mine)).not.toBe(before);
  });

  it("gives null, so initials, for someone of another organisation reached through a join", async () => {
    const src = async (id: string) => (await db.select({ src: avatarSrcIn(tenantId) }).from(t.users).where(eq(t.users.id, id)))[0].src;
    expect(await src(mine)).toMatch(`/api/avatar/${mine}?v=`);
    expect(await src(theirs)).toBeNull();
  });
});
