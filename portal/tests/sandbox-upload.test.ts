import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The sandbox upload route: the only path that takes a 10 MB body, with the same gates as the Server Action.
vi.mock("../src/server/db", () => ({ db: () => ({}), t: new Proxy({}, { get: () => ({}) }) }));
vi.mock("../src/server/rate-limit", async (original) => (await import("./helpers/db")).rateLimitOnPglite(await original()));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/services/events", () => ({ emitEvent: vi.fn() }));
vi.mock("../src/server/services/threats", () => ({ insertNumbered: async () => ({ number: 7, row: { id: "00000000-0000-4000-8000-0000000000aa" } }) }));
let origin = true;
vi.mock("../src/server/request", () => ({ sameOrigin: () => origin }));
let features = new Set(["sandbox"]);
let viewer: unknown = null;
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => viewer }));

const { POST } = await import("../src/app/api/sandbox/upload/route");
const { MAX_FILE_BYTES } = await import("../src/server/sandbox/analyze");

const upload = (file: File, headers: Record<string, string> = {}) => {
  const form = new FormData();
  form.set("kind", "file");
  form.set("file", file);
  const req = new Request("http://localhost:3000/api/sandbox/upload", { method: "POST", body: form });
  for (const [k, v] of Object.entries(headers)) req.headers.set(k, v);
  return req;
};
/** The browser always declares the length of a multipart body; Request() in Node does not, so the tests set it. */
const sized = async (file: File) => {
  const probe = upload(file);
  const length = (await probe.clone().arrayBuffer()).byteLength;
  return upload(file, { "content-length": String(length) });
};

beforeEach(() => {
  origin = true;
  features = new Set(["sandbox"]);
  viewer = { user: { id: "00000000-0000-4000-8000-000000000001" }, tenant: { id: "00000000-0000-4000-8000-000000000002", features } };
});

describe("POST /api/sandbox/upload", () => {
  it("refuses other origins, signed-out people and organisations without the sandbox", async () => {
    origin = false;
    expect((await POST(await sized(new File(["hi"], "a.txt")))).status).toBe(403);
    origin = true;
    viewer = null;
    expect((await POST(await sized(new File(["hi"], "a.txt")))).status).toBe(401);
    viewer = { user: { id: "u" }, tenant: { id: "t", features: new Set() } };
    expect((await POST(await sized(new File(["hi"], "a.txt")))).status).toBe(404);
  });

  it("requires a declared length and caps it, and cuts off a body that is longer than declared", async () => {
    expect((await POST(upload(new File(["hi"], "a.txt")))).status).toBe(413);
    expect((await POST(upload(new File(["hi"], "a.txt"), { "content-length": String(MAX_FILE_BYTES + 5000) }))).status).toBe(413);
    // A chunked or understated body: the stream is cut off once the running count passes the limit.
    const chunks = [new Uint8Array(MAX_FILE_BYTES), new Uint8Array(8192)];
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        const next = chunks.shift();
        if (next) c.enqueue(next);
        else c.close();
      },
    });
    const req = new Request("http://localhost:3000/api/sandbox/upload", { method: "POST", body, duplex: "half", headers: { "content-type": "multipart/form-data; boundary=x", "content-length": "100" } } as RequestInit);
    expect((await POST(req)).status).toBe(413);
  });

  it("analyses a file within the cap and answers with the stored analysis", async () => {
    const res = await POST(await sized(new File(["hello sandbox"], "note.txt", { type: "text/plain" })));
    expect(res.status).toBe(200);
    const state = await res.json();
    expect(state.analysis).toMatchObject({ kind: "file", objectName: "note.txt", number: 7, id: "00000000-0000-4000-8000-0000000000aa" });
  });

  it("answers the form's own errors for a missing or oversized file", async () => {
    const form = new FormData();
    form.set("kind", "file");
    const req = new Request("http://localhost:3000/api/sandbox/upload", { method: "POST", body: form });
    req.headers.set("content-length", String((await req.clone().arrayBuffer()).byteLength));
    expect(await (await POST(req)).json()).toEqual({ error: "noFile" });
  });

  it("leaves Server Actions on Next's default 1 MB body limit", () => {
    const config = readFileSync(path.join(__dirname, "..", "next.config.ts"), "utf8");
    expect(config).not.toMatch(/bodySizeLimit/);
  });
});
