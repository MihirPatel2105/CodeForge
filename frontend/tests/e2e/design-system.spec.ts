import { expect, test, type Page } from "@playwright/test";

// The editorial design system (DESIGN.md, Anthropic marketing surface): slate ink on an ivory
// canvas, cream cards lifted by a value step and a hairline rather than a shadow, serif lead
// prose, tracked sans uppercase eyebrows, 8px controls and 16px cards. The landing hero and the top bar
// keep their own look and are checked here so the system never leaks into them.
const CANVAS = "rgb(250, 249, 245)";
const INK = "rgb(20, 20, 19)";

const style = (page: Page, selector: string, property: string) =>
  page.locator(selector).first().evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);

test("pages paint slate ink on the ivory canvas", async ({ page }) => {
  await page.goto("/privacy");
  expect(await style(page, "body", "color")).toBe(INK);
  const canvas = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim());
  expect(canvas.toLowerCase()).toBe("#faf9f5");
});

test("landing cards are flat: a lighter step and a hairline, never a drop shadow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const selector of [".ol-product-shell", ".el-card", ".el-loop"]) {
    const shadow = await style(page, selector, "box-shadow");
    expect(shadow, selector).toBe("none");
  }
  expect(await style(page, ".el-card", "border-top-width")).toBe("1px");
  expect(await style(page, ".el-card", "background-color")).not.toBe(CANVAS);
});

test("section heads read as serif titles over sans leads", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await style(page, ".el-head h2", "font-family")).toContain("Newsreader");
  expect(await style(page, ".el-head h2", "font-weight")).toBe("400");
  expect(await style(page, ".el-head > p", "font-family")).toContain("Hanken Grotesk");
});

test("primary actions take 12px corners, controls 8px and cards 16px", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#start-building .el-primary")).toHaveCSS("border-radius", "12px");
  await expect(page.locator("#start-building .el-primary")).toHaveCSS("height", "44px");
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { panel: root.getPropertyValue("--premium-radius-panel").trim(), control: root.getPropertyValue("--ui-radius-control").trim() };
  });
  expect(tokens).toEqual({ panel: "16px", control: "8px" });
});

test("the repair loop sits on the canvas, with colour kept for the return and the pass", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await style(page, ".el-page", "background-color")).toBe(CANVAS);
  expect(await style(page, "#repair-loop", "background-color")).toBe("rgba(0, 0, 0, 0)");
  const loop = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--loop").trim());
  expect(loop).not.toBe("");
  expect(await style(page, ".el-loop-return .el-meta", "color")).not.toBe(await style(page, ".el-loop-row .el-meta", "color"));
});

test("the landing hero and the top bar keep their own design", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const header = page.locator("[data-launch-header]");
  await expect(header).toHaveAttribute("data-tone", "hero");
  await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(header.locator(".lh-pill").first()).toHaveCSS("border-radius", "999px");
  await expect(page.locator(".lh-hero .lh-title")).toHaveCSS("color", "rgb(245, 243, 238)");
  // Past the hero the bar takes the page colour, which is now the ivory canvas.
  const heroEnd = await page.locator("#overview").evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
  await page.evaluate((y) => window.scrollTo({ top: y + 200, behavior: "instant" }), heroEnd);
  await expect(header).toHaveAttribute("data-tone", "page");
  await expect(header).toHaveCSS("background-color", CANVAS);
});

test("editorial pages open on the canvas: ink serif headline, sans label, ink button", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/about", "/how-it-works", "/faq", "/contact"]) {
    await page.goto(route);
    const hero = page.locator("#overview");
    await expect(page.locator("main"), route).toHaveCSS("background-color", CANVAS);
    await expect(hero.locator(".cf-hero-rays, .mk-hero-fade, canvas")).toHaveCount(0);
    const title = hero.getByRole("heading", { level: 1 });
    await expect(title).toHaveCSS("color", INK);
    expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Newsreader");
    // Labels are sentence case in the sans, as on Anthropic's pages; uppercase is kept for product UI.
    const label = hero.locator(".em-label");
    await expect(label).toHaveCSS("text-transform", "none");
    expect(await label.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Hanken Grotesk");
    const primary = hero.locator(".em-actions .el-primary").first();
    if (await primary.count()) {
      await expect(primary).toHaveCSS("background-color", INK);
      await expect(primary).toHaveCSS("border-radius", "12px");
    }
    // The bar is solid from the top and takes its own space.
    const header = page.locator("[data-launch-header]");
    await expect(header).toHaveAttribute("data-tone", "page");
    await expect(header).not.toHaveAttribute("data-overlay", "");
    const [barBottom, heroTop] = await Promise.all([
      header.evaluate((bar) => bar.getBoundingClientRect().bottom),
      hero.evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(heroTop).toBeGreaterThanOrEqual(barBottom - 1);
  }
});

test("sign-in pages put the form on the cream canvas beside the horizon band, no ray atmosphere", async ({ page }) => {
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ["/login", "/signup", "/forgot-password"]) {
    await page.goto(route);
    await expect(page.locator(".pa-auth"), route).toHaveCSS("background-color", CANVAS);
    await expect(page.locator(".pa-atmosphere, .side-rays")).toHaveCount(0);
    await expect(page.locator(".ah-panel .ah-headline")).toHaveCSS("color", "rgb(245, 243, 238)");
    await expect(page.locator(".pa-form")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".pa-form")).toHaveCSS("box-shadow", "none");
  }
});

test("the landing's closing section meets the black footer with no gradient between them", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const closing = page.locator("#start-building");
  // The closing section is transparent on the canvas-coloured page.
  await expect(closing).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(await style(page, ".el-page", "background-color")).toBe(CANVAS);
  const after = await closing.evaluate((el) => getComputedStyle(el, "::after").backgroundImage);
  expect(after).toBe("none");
  await expect(page.getByRole("contentinfo")).toHaveCSS("background-color", "rgb(0, 0, 0)");
});

test("account pages sit on the bar's ivory, with a serif page title instead of a dark banner", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", (route) => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ json: { id: "u", email: "member@example.com", first_name: "Member", is_admin: false, totp_enabled: true, created_at: "2026-10-01T09:00:00Z" } }));
  await page.route("**/api/backend/runs/attention", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/backend/projects**", (route) => route.fulfill({ json: [] }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/profile", "/profile/settings"]) {
    await page.goto(route);
    const workspace = page.locator(".account-workspace").first();
    await expect(workspace, route).toHaveCSS("background-color", CANVAS);
    const banner = page.locator(".profile-page-intro, .settings-premium-hero").first();
    await expect(banner, route).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(banner, route).toHaveCSS("background-image", "none");
    const title = banner.locator("p, h1").first();
    await expect(title, route).toHaveCSS("color", INK);
    expect(await title.evaluate((el) => getComputedStyle(el).fontFamily), route).toContain("Newsreader");
  }
});
