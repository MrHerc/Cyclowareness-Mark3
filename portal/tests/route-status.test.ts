import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isGame } from "@/server/lab/games";

const app = path.resolve(__dirname, "../src/app");

/** Calls that answer notFound(): the function itself, and the viewer guards that call it for a missing permission or plan feature. */
const NOT_FOUND = /\bnotFound\(\)|\brequirePermission\(|\brequireFeature\(/;

/** Every route under src/app whose page can answer notFound() (from page.tsx or a lookup next to it), relative to src/app. */
function notFoundPages(dir = app): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && e.name !== "not-found.tsx" && e.name !== "loading.tsx");
  const own = files.some((e) => e.name === "page.tsx") && files.some((e) => NOT_FOUND.test(readFileSync(path.join(dir, e.name), "utf8")));
  return [...(own ? [path.relative(app, dir)] : []), ...entries.filter((e) => e.isDirectory()).flatMap((e) => notFoundPages(path.join(dir, e.name)))];
}

/** The source of a route directory's own files (page.tsx and the lookups next to it), the files notFoundPages() reads. */
function routeSource(route: string): string {
  const dir = path.join(app, route);
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && e.name !== "not-found.tsx" && e.name !== "loading.tsx")
    .map((e) => readFileSync(path.join(dir, e.name), "utf8"))
    .join("\n");
}

/**
 * A page in a route group such as admin/incidents/(index), whose loading.tsx sits next to it in the group,
 * is guarded by the section's layout.tsx above the group when that layout runs every permission, feature
 * and plan-feature check the page answers notFound() for (as in admin/incidents/layout.tsx). Layouts below
 * the boundary do not count: they render inside it.
 */
function groupGuarded(page: string, dir: string, own: string): boolean {
  if (dir !== page || !/\(.+\)$/.test(page)) return false;
  const features = [...own.matchAll(/if \(!(hasFeature\(v, "\w+"\))\) notFound\(\)/g)].map((m) => m[1]);
  // Any other notFound() is a lookup of the page's own, which no section layout can run.
  if ((own.match(/\bnotFound\(\)/g) ?? []).length !== features.length) return false;
  const checks = [...(own.match(/\brequire(?:Feature|Permission)\([^)]*\)/g) ?? []), ...features];
  let section = page;
  while (/(^|[\\/])\([^\\/]+\)$/.test(section)) section = path.dirname(section);
  const layout = path.join(app, section, "layout.tsx");
  if (!checks.length || !existsSync(layout)) return false;
  const src = readFileSync(layout, "utf8");
  return checks.every((c) => src.includes(c));
}

describe("loading.tsx placement", () => {
  // A loading.tsx is a Suspense boundary: once its fallback streams, a notFound() below it can no longer
  // set the status, so the not-found UI goes out as HTTP 200. The page's own layout.tsx renders before the
  // boundary of its own segment (never before one further up), so a boundary is fine only there, with the
  // page's lookup running in that layout (as in admin/users/[id]). A boundary further up is fine too when the page
  // has no notFound() of its own and every feature or permission guard it calls already runs in a layout at or
  // above that boundary (as in (learner)/paths/layout.tsx above paths/(index)/loading.tsx).
  it("keeps loading boundaries off the path to a page that calls notFound(), except under the layouts that run its checks", () => {
    const offenders = notFoundPages().flatMap((page) => {
      const segments = page ? page.split(path.sep) : [];
      const dirs = ["", ...segments.map((_, i) => segments.slice(0, i + 1).join(path.sep))];
      const own = routeSource(page);
      const guards = own.match(/\brequire(?:Feature|Permission)\([^)]*\)/g) ?? [];
      return dirs.flatMap((dir, i) => {
        if (!existsSync(path.join(app, dir, "loading.tsx"))) return [];
        const layouts = dirs.slice(0, i + 1).map((d) => path.join(app, d, "layout.tsx")).filter(existsSync).map((f) => readFileSync(f, "utf8"));
        const guarded =
          (dir === page && existsSync(path.join(app, dir, "layout.tsx"))) ||
          groupGuarded(page, dir, own) ||
          (!/\bnotFound\(\)/.test(own) && guards.every((g) => layouts.some((l) => l.includes(g))));
        return guarded ? [] : [`${dir}/loading.tsx above ${page}/page.tsx`];
      });
    });
    expect(offenders).toEqual([]);
  });

  it("gives every learner page reached from the navigation, and the pages under it, a skeleton of its own", () => {
    const routes = ["(home)", "learn/(catalog)", "learn/[slug]", "paths/(index)", "paths/[key]", "lab/(index)", "lab/[game]", "league", "progress", "security/(overview)", "security/sandbox", "profile", "sessions", "help/(index)", "help/tickets/[id]"];
    const missing = routes.map((r) => path.join("(learner)", r)).filter((r) => !existsSync(path.join(app, r, "page.tsx")) || !existsSync(path.join(app, r, "loading.tsx")));
    expect(missing).toEqual([]);
  });

  it("gives every admin page reached from the navigation, and the detail pages that have one, a skeleton of its own", () => {
    const routes = ["(overview)", "users/(index)", "users/[id]", "assignments", "campaigns/(index)", "campaigns/[id]", "policies/(index)", "policies/[id]", "problems", "ops", "loops/(index)", "loops/[id]", "threats", "approvals", "incidents/(index)", "incidents/[id]", "campaigns/new", "campaigns/edit/[id]", "sandbox/(index)", "sandbox/[id]", "intel/[kind]", "risk", "studio", "paths", "sessions", "reports", "leadership", "league", "audit", "departments", "settings", "support/(index)", "support/[id]", "feedback"];
    const missing = routes.map((r) => path.join("(admin)", "admin", r)).filter((r) => !existsSync(path.join(app, r, "page.tsx")) || !existsSync(path.join(app, r, "loading.tsx")));
    expect(missing).toEqual([]);
  });

  it("gives the operator console a skeleton under the layout that runs its permission check", () => {
    expect(existsSync(path.join(app, "(admin)", "super", "loading.tsx"))).toBe(true);
    expect(readFileSync(path.join(app, "(admin)", "super", "layout.tsx"), "utf8")).toContain('requirePermission("platform.manage")');
  });
});

describe("isGame", () => {
  it("accepts the lab games and rejects anything else, Object.prototype keys included", () => {
    expect(isGame("inbox-triage")).toBe(true);
    expect(isGame("password-forge")).toBe(true);
    for (const v of ["no-such-game", "constructor", "toString", "__proto__", "hasOwnProperty", ""]) expect(isGame(v)).toBe(false);
  });
});
