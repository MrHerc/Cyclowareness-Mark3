import { expect, test, type Page } from "@playwright/test";

/** The seeded demo accounts (scripts/seed-data.ts, scripts/seed.ts); playwright.config.ts resolves the password. */
const password = process.env.SEED_PASSWORD!;

/** Two-step sign-in: the address, then the password; then `next`. The sign-in page follows the browser's language. */
async function signIn(page: Page, email: string, next: string) {
  const locale = test.info().project.use.locale!;
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await page.locator("#email").fill(email);
  await page.locator("#email").press("Enter");
  await page.locator("#password").fill(password);
  await page.locator("#password").press("Enter");
  await expect(page).not.toHaveURL(/\/sign-in/);
}

/** Signed in, the profile language (Azerbaijani for the seeded accounts) wins: switch to the project's in the header. */
async function useProjectLanguage(page: Page) {
  const locale = test.info().project.use.locale!;
  await page.locator("header select").first().selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
}

test("learner: Home, a module and a lesson scene", async ({ page }) => {
  await signIn(page, "learner@safarovindustries.com", "/app");
  await expect(page).toHaveURL(/\/app$/);
  await useProjectLanguage(page);

  const learnLinks = page.locator("main a[href^='/learn/']");
  await expect(learnLinks.first()).toBeVisible();
  const hrefs = await learnLinks.evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  const moduleHref = hrefs.find((href) => /^\/learn\/[^/?#]+$/.test(href))!;
  await page.locator(`main a[href='${moduleHref}']`).first().click();
  await expect(page).toHaveURL(new RegExp(`${moduleHref}$`));

  await page.locator(`main a[href^='${moduleHref}/']`).first().click();
  await expect(page).toHaveURL(new RegExp(`${moduleHref}/[^/]+$`));
  const player = page.locator("main#main");
  // The intro shows the lesson title (h1) and Start (or Continue) first; a scene replaces it.
  await expect(player.locator("h1")).toBeVisible();
  await player.getByRole("button").first().click();
  await expect(player.locator("h1")).toHaveCount(0);
  await expect(player.locator("h2, ol").first()).toBeVisible();
});

test("admin: console, People and the campaign wizard", async ({ page }) => {
  await signIn(page, "admin@safarovindustries.com", "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  // The first-visit guide opens by itself and covers the page until it is closed.
  const tour = page.getByRole("dialog");
  await expect(tour).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour).toBeHidden();
  await useProjectLanguage(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.locator("a[href='/admin/users']").first().click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByText("Günel Hüseynova").first()).toBeVisible();

  await page.locator("a[href='/admin/campaigns']").first().click();
  await expect(page).toHaveURL(/\/admin\/campaigns$/);
  await page.locator("main a[href='/admin/campaigns/new']").first().click();
  await expect(page).toHaveURL(/\/admin\/campaigns\/new$/);
  await expect(page.locator("main h2").first()).toBeVisible();
});

test("operator: the console asks for two-step verification first", async ({ page }) => {
  await signIn(page, "operator@cyclowareness.com", "/super");
  // The platform operator always needs two-step verification (twoFactorRequired), so /super sends them to set it up.
  await expect(page).toHaveURL(/\/profile\?section=security&required=1$/);
  await useProjectLanguage(page);
});
