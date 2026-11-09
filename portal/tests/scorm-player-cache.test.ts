import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

// The build script stands in for scripts/build-scorm-player.ts: it writes the two files and counts the builds.
const h = vi.hoisted(() => ({ builds: 0 }));
vi.mock("node:child_process", () => ({
  execFile: (_cmd: string, args: string[], _opts: unknown, cb: (err: Error | null, out: string) => void) => {
    const dir = args.at(-1)!;
    h.builds++;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "player.js"), `build ${h.builds}`);
    fs.writeFileSync(path.join(dir, "player.css"), "css");
    cb(null, "");
  },
}));

const { scormPlayer } = await import("@/server/scorm/player");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-cache-"));
const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
afterAll(() => {
  cwd.mockRestore();
  fs.rmSync(root, { recursive: true, force: true });
});

const touch = (file: string, at: number) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "");
  fs.utimesSync(file, at / 1000, at / 1000);
};

describe("SCORM player cache", () => {
  it("builds once when missing, reuses a current build and rebuilds one older than its sources", async () => {
    const source = path.join(root, "src", "scorm", "app.tsx");
    touch(source, Date.now() - 60_000);
    expect((await scormPlayer()).js.toString()).toBe("build 1");
    expect((await scormPlayer()).js.toString()).toBe("build 1");

    touch(source, Date.now() + 60_000);
    expect((await scormPlayer()).js.toString()).toBe("build 2");
    expect(h.builds).toBe(2);
  });

  it("never rebuilds where the sources are absent (the Docker image)", async () => {
    fs.rmSync(path.join(root, "src"), { recursive: true });
    expect((await scormPlayer()).css.toString()).toBe("css");
    expect(h.builds).toBe(2);
  });
});
