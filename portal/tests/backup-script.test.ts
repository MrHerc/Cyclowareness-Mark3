import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * scripts/backup.sh and scripts/restore.sh run with stand-ins for `docker` (prints a fake dump, or keeps what the
 * restore pipes into the database container) and `age` (wraps the input in a marker naming the key).
 */
const scripts = path.join(__dirname, "..", "scripts");
const hasSh = spawnSync("sh", ["-c", "exit 0"]).status === 0;

function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), "backup-"));
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  const tool = (name: string, body: string) => {
    writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(path.join(bin, name), 0o755);
  };
  tool("docker", `case "$*" in *pg_dump*) printf 'PGDMP-dump' ;; *"cat > /tmp/restore.dump"*) cat > "$RESTORED" ;; esac`);
  tool("age", `if [ "$1" = "-r" ]; then printf 'AGE[%s]' "$2"; cat; else [ "$3" = "$GOOD_IDENTITY" ] || exit 1; sed 's/^AGE\\[[^]]*\\]//' "$4"; fi`);
  const run = (script: string, args: string[], env: Record<string, string>, input = "") =>
    spawnSync("sh", [path.join(scripts, script), ...args], { cwd: root, input, encoding: "utf8", env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, RESTORED: path.join(root, "restored"), GOOD_IDENTITY: "id.txt", ...env } });
  return { root, run };
}

describe("backup.sh", () => {
  it("never tells the operator to ship APP_SECRET with the dumps", () => {
    const text = readFileSync(path.join(scripts, "backup.sh"), "utf8");
    expect(text).not.toMatch(/together with APP_SECRET/);
    expect(text).toMatch(/^umask 077$/m);
  });

  it.skipIf(!hasSh)("writes an owner-only dump into an owner-only folder, tightening one that existed", () => {
    const { root, run } = sandbox();
    const dir = path.join(root, "backups");
    mkdirSync(dir, { mode: 0o755 });
    const res = run("backup.sh", [], { BACKUP_DIR: dir });
    expect(res.status, res.stderr).toBe(0);
    const [file] = readdirSync(dir);
    expect(file).toMatch(/^portal-\d{8}-\d{6}\.dump$/);
    expect(readFileSync(path.join(dir, file), "utf8")).toBe("PGDMP-dump");
    // Windows has no POSIX modes to check.
    if (process.platform !== "win32") {
      expect(statSync(dir).mode & 0o777).toBe(0o700);
      expect(statSync(path.join(dir, file)).mode & 0o777).toBe(0o600);
    }
  }, 120_000);

  it.skipIf(!hasSh)("encrypts with age when BACKUP_AGE_RECIPIENT is set, and restore.sh decrypts it with the identity", () => {
    const { root, run } = sandbox();
    const dir = path.join(root, "backups");
    const res = run("backup.sh", [], { BACKUP_DIR: dir, BACKUP_AGE_RECIPIENT: "age1test" });
    expect(res.status, res.stderr).toBe(0);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^portal-\d{8}-\d{6}\.dump\.age$/);
    expect(readFileSync(path.join(dir, files[0]), "utf8")).toBe("AGE[age1test]PGDMP-dump");

    const dump = path.join("backups", files[0]);
    const refused = run("restore.sh", [dump], {}, "restore\n");
    expect(refused.status).toBe(2);
    expect(refused.stderr).toMatch(/BACKUP_AGE_IDENTITY/);
    // A wrong identity stops before the database is emptied.
    const wrong = run("restore.sh", [dump], { BACKUP_AGE_IDENTITY: "other.txt" }, "restore\n");
    expect(wrong.status).not.toBe(0);
    const restored = run("restore.sh", [dump], { BACKUP_AGE_IDENTITY: "id.txt" }, "restore\n");
    expect(restored.status, restored.stderr).toBe(0);
    expect(readFileSync(path.join(root, "restored"), "utf8")).toBe("PGDMP-dump");
  }, 120_000);
});
