import { describe, expect, it, vi } from "vitest";

const getViewer = vi.fn(async () => null);
vi.mock("../src/server/auth/viewer", () => ({ getViewer, allowed: () => true, twoFactorGap: () => false }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

const { apiViewer, rscProbe } = await import("../src/server/auth/api");
const url = "http://n/api/admin/reports/completion?format=csv";

describe("apiViewer", () => {
  it("answers the RSC pre-render of a download link with an empty 204, before any check", async () => {
    const res = await apiViewer("reports.read", new Request(url, { headers: { rsc: "1", "sec-fetch-mode": "navigate" } }));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(204);
    expect(await (res as Response).text()).toBe("");
    expect(getViewer).not.toHaveBeenCalled();
  });

  it("still sends a signed-out browser navigation to sign-in", async () => {
    const res = (await apiViewer("reports.read", new Request(url, { headers: { "sec-fetch-mode": "navigate" } }))) as Response;
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/sign-in?next=${encodeURIComponent("/api/admin/reports/completion?format=csv")}`);
  });

  it("leaves requests without the RSC header alone", () => {
    expect(rscProbe(new Request(url))).toBeNull();
    expect(rscProbe(new Request(url, { headers: { rsc: "0" } }))).toBeNull();
  });
});
