import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`Gradient ASCII hero remains readable and usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const original = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        const canvas = this.canvas as HTMLCanvasElement;
        if (canvas.closest(".hero-ascii")) canvas.dataset.draws = String(Number(canvas.dataset.draws ?? 0) + 1);
        return original.apply(this, args);
      };
    });
    await page.goto("/");
    const ascii = page.locator(".hero-ascii");
    await expect(ascii).toHaveAttribute("data-ready", "true");
    await expect(page.locator(".lp-hero .threads-layer")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your idea.");
    const action = page.locator(".lp-hero").getByRole("link", { name: "Build your first API" });
    await expect(action).toBeVisible();
    await action.click({ trial: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Pause background", exact: true }).click();
    await expect(ascii).toHaveAttribute("data-motion", "static");
    await page.getByRole("button", { name: "Background paused", exact: true }).click();
    await expect(ascii).toHaveAttribute("data-motion", "animated");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(ascii).toHaveAttribute("data-motion", "static");
    // No further GPU draw calls should run after reduced motion has settled.
    const canvas = ascii.locator("canvas");
    await page.waitForTimeout(150);
    const still = await canvas.getAttribute("data-draws");
    expect(Number(still)).toBeGreaterThan(0);
    await page.mouse.move(20, 250);
    await page.waitForTimeout(150);
    await expect(canvas).toHaveAttribute("data-draws", still!);
    await page.screenshot({ path: `/tmp/codeforge-ascii-${width}.png` });
    await page.locator("#how").scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator(".ascii-layer").evaluate(node => Number(getComputedStyle(node).opacity))).toBe(0);
    await expect(page.locator("#team-title")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("hero has a static fallback without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".hero-ascii")).toBeVisible();
  await expect(page.locator(".ascii-layer")).toHaveCSS("background-color", "rgb(8, 13, 27)");
  await expect(page.locator(".lp-hero").getByRole("link", { name: "Build your first API" })).toBeVisible();
});
