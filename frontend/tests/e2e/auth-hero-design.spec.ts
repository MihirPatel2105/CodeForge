import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/backend/auth/me", route => route.fulfill({ status: 401, json: {} }));
});

test("auth routes share the horizon band and a readable form on cream", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("codeforge_password_mfa", JSON.stringify({ ticket: "design-ticket", email: "user@example.com", methods: ["totp"], startedAt: Date.now() })));
  for (const route of ["/login", "/signup", "/forgot-password", "/reset-password/example-token", "/login/verify"]) {
    await page.goto(route);
    await expect(page.locator(".ah-panel")).toBeVisible();
    await expect(page.locator(".pa-atmosphere")).toHaveCount(0);
    await expect(page.locator(".pa-auth")).toHaveCSS("background-color", "rgb(250, 249, 245)");
    const story = await page.locator(".ah-panel").boundingBox();
    const form = await page.locator(".pa-form").boundingBox();
    expect(story!.x + story!.width).toBeLessThan(form!.x);
    expect(form!.x + form!.width).toBeLessThanOrEqual(1440);
    await expect(page.locator(".ah-panel .ah-headline")).toHaveCSS("color", "rgb(245, 243, 238)");
    // The form sits straight on the ivory canvas, no card.
    await expect(page.locator(".pa-form")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
    await page.screenshot({ path: `/tmp/codeforge-auth-hero-${route.slice(1).replaceAll("/", "-")}.png`, fullPage: true });
  }
});

test("mobile keeps a compact brand header and focuses the form without a WebGL canvas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
    // The band shrinks to a short strip above the form.
    expect((await page.locator(".ah-panel").boundingBox())!.height).toBeLessThanOrEqual(240);
    await expect(page.locator(".pa-atmosphere canvas")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/codeforge-auth-hero-mobile-${width}.png`, fullPage: true });
  }
});
