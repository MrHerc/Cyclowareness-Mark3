import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

const sendMail = vi.fn(async () => ({}));
const createTransport = vi.fn((options: Record<string, unknown>) => (void options, { sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport: (o: Record<string, unknown>) => createTransport(o) } }));
// The saved mail server name resolves to a public address once; a second lookup would rebind it.
const lookup = vi.fn(async () => [{ address: "8.8.4.4", family: 4 }]);
vi.mock("node:dns/promises", () => ({ lookup: () => lookup() }));
vi.mock("../src/server/env", () => ({ env: { isProd: false } }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
const { queueEmail, redactAccountLinks } = await import("../src/server/mail");

let tenantId = "";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const settings = { email: { enabled: true, host: "smtp.acme.example", port: 587, fromAddress: "training@acme.example" } };
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: settings as never }).returning();
  tenantId = tenant.id;
}, 180_000);

describe("account links in the outbox", () => {
  it("are replaced once the message is delivered, and the message went out with the live link to the approved address", async () => {
    const link = "https://portal.example/account/invite/abcdefghijklmnopqrstuvwxyz234567";
    const text = `Hello,\n\nSet up your account:\n\n${link}`;
    const res = await queueEmail(db, tenantId, { to: "aysel@acme.example", kind: "welcome", subject: "Welcome", text, html: `<a href="${link}">Open</a>`, lang: "en" });
    expect(res.status).toBe("sent");
    // Connected to the address the destination check approved; the certificate is still checked against the name.
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "8.8.4.4", servername: "smtp.acme.example", port: 587 }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ text, html: `<a href="${link}">Open</a>` }));
    const [row] = await db.select().from(t.outbox).where(eq(t.outbox.id, res.id));
    expect(row.text).toBe("Hello,\n\nSet up your account:\n\nhttps://portal.example/account/invite/redacted");
    expect(row.html).toBe('<a href="https://portal.example/account/invite/redacted">Open</a>');
  });

  it("logs a refused delivery with the server's codes but without the recipient's address", async () => {
    const rejection = Object.assign(new Error("Can't send mail - all recipients were rejected: 550 5.1.1 <name@bank.az>: Recipient address rejected"), { code: "EENVELOPE", responseCode: 550 });
    sendMail.mockRejectedValueOnce(rejection);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await queueEmail(db, tenantId, { to: "name@bank.az", kind: "welcome", subject: "Welcome", text: "Hello", html: "<p>Hello</p>", lang: "en" });
      expect(res.status).toBe("queued");
      const line = error.mock.calls.map((c) => String(c[0])).find((l) => l.includes("[mail] delivery"));
      expect(line).toContain("550");
      expect(line).toContain("EENVELOPE");
      expect(line).not.toContain("name@bank.az");
    } finally {
      error.mockRestore();
    }
  });

  it("redacts reset links too and leaves other links alone", () => {
    expect(redactAccountLinks("https://p.example/account/reset/abc234?x=1 https://p.example/learn/phishing")).toBe("https://p.example/account/reset/redacted?x=1 https://p.example/learn/phishing");
  });
});
