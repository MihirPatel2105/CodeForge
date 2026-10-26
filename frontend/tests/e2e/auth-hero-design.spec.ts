import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/backend/auth/me", route => route.fulfill({ status: 401, json: {} }));
});

test("auth routes share the dark hero atmosphere and readable form", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("codeforge_password_mfa", JSON.stringify({ ticket: "design-ticket", email: "user@example.com", methods: ["totp"], startedAt: Date.now() })));
  for (const route of ["/login", "/signup", "/forgot-password", "/reset-password/example-token", "/login/verify"]) {
    await page.goto(route);
    await expect(page.locator(".pa-story")).toBeVisible();
    await expect(page.locator(".pa-atmosphere")).toHaveAttribute("data-motion", "static");
    await expect(page.locator(".pa-atmosphere canvas")).toHaveCount(0);
    await expect(page.locator(".pa-auth")).toHaveCSS("background-color", "rgb(7, 9, 15)");
    const story = await page.locator(".pa-story").boundingBox();
    const background = await page.locator(".pa-atmosphere").boundingBox();
    const form = await page.locator(".pa-form").boundingBox();
    expect(story!.x + story!.width).toBeLessThan(background!.width);
    expect(form!.x + form!.width).toBeLessThanOrEqual(background!.width);
    await expect(page.locator(".pa-story h2")).toHaveCSS("color", "rgb(248, 250, 255)");
    await expect(page.locator(".pa-form")).toHaveCSS("background-color", "rgb(255, 255, 255)");
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
    await expect(page.locator(".pa-story")).toBeHidden();
    await expect(page.locator(".pa-atmosphere canvas")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/codeforge-auth-hero-mobile-${width}.png`, fullPage: true });
  }
});

test("Side Rays follows reduced motion and stays mounted when switching auth forms", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  const background = page.locator(".pa-atmosphere");
  await expect(background).toHaveAttribute("data-motion", "animated");
  await expect(background.locator(".side-rays canvas")).toHaveCount(1);
  await background.evaluate(node => node.setAttribute("data-persist-check", "auth-rays"));
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toBeFocused();
  await expect(background).toHaveAttribute("data-persist-check", "auth-rays");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(background).toHaveAttribute("data-motion", "static");
  await expect(background.locator("canvas")).toHaveCount(0);
});
