import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 320]) {
  test(`product-led hero stays readable and usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your idea. A working API.", exact: true })).toBeVisible();
    await expect(page.locator(".lp-hero")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".ol-product-workspace")).toBeVisible();
    await expect(page.locator(".ol-product-outcome")).toContainText("8 / 8 tests passed");
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
