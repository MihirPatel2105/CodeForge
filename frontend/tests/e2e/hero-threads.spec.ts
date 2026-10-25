import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 320]) {
  test(`product-led hero stays readable and usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your idea. A working API.", exact: true })).toBeVisible();
    await expect(page.locator(".ol-announcement, .ol-desktop-nav")).toHaveCount(0);
    await expect(page.locator(".cf-site-header")).toHaveCSS("height", "64px");
    for (const button of await page.locator('.lp-button, .cf-site-header a[href="/signup"]').all()) {
      const shape = await button.evaluate(element => ({ radius: parseFloat(getComputedStyle(element).borderRadius), height: element.getBoundingClientRect().height }));
      expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2);
    }
    await expect(page.locator(".lp-hero")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".ol-product-workspace")).toBeVisible();
    await expect(page.locator(".ol-product-outcome")).toContainText("Tests + execution logs");
    const action = page.locator(".lp-actions").getByRole("link", { name: "Build your first API", exact: true });
    await expect(action).toHaveAttribute("href", "/signup");
    await action.click({ trial: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".ol-product-shell")).toHaveCSS("transform", "none");
    await expect(page.locator(".ol-tech-track")).toHaveCSS("animation-name", "none");
    const preview = page.locator(".ol-product-shell");
    await preview.scrollIntoViewIfNeeded();
    const before = await preview.boundingBox();
    await page.mouse.move(20, 250);
    await expect.poll(async () => (await preview.boundingBox())!.width).toBe(before!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}

test("the product preview and navigation work without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Follow the Library build", exact: true }).click();
  await expect(page.locator("#cf-story-title")).toBeInViewport();
  await expect(page.locator(".ol-process-panel")).toHaveCount(4);
});

test("signed-in header keeps CodeForge account actions and capsule Projects button", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "header-user", first_name: "Preview", email: "preview@example.com", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.goto("/");
  const header = page.locator(".cf-site-header");
  const projects = header.getByRole("link", { name: "Projects", exact: true });
  await expect(projects).toBeVisible();
  const shape = await projects.evaluate(element => ({ radius: parseFloat(getComputedStyle(element).borderRadius), height: element.getBoundingClientRect().height }));
  expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2);
  await expect(header.getByRole("button", { name: "Open command palette" })).toBeVisible();
  await expect(header.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});
