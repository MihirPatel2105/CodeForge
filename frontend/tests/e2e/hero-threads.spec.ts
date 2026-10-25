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
    await expect(page.locator(".cf-site-header-bar")).toHaveCSS("background-color", /(?:rgba\(0, 0, 0, 0\)|color\(srgb 0 0 0 \/ 0\))/);
    await expect(page.locator(".cf-site-header .cf-logo-lockup")).toHaveCSS("filter", "none");
    await expect(page.locator(".lp-hero .threads-layer")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your idea.");
    const coverage = await page.locator(".lp-hero").evaluate(hero => {
      const backdrop = hero.querySelector(".ascii-layer")!.getBoundingClientRect();
      const bounds = hero.getBoundingClientRect();
      return { gap: bounds.bottom - backdrop.bottom, widthGap: bounds.width - backdrop.width, height: bounds.height, viewportHeight: window.innerHeight, mask: getComputedStyle(hero.querySelector(".ascii-layer")!).maskImage };
    });
    expect(Math.abs(coverage.gap)).toBeLessThan(1);
    expect(Math.abs(coverage.widthGap)).toBeLessThan(1);
    expect(coverage.height).toBeGreaterThanOrEqual(coverage.viewportHeight);
    expect(coverage.mask).toBe("none");
    const action = page.locator(".lp-hero").getByRole("link", { name: "Build your first API" });
    await expect(action).toBeVisible();
    // Finish the entrance before scrolling to the action; its translated position
    // otherwise changes the scroll-dependent background and button palette.
    await expect(page.locator(".lp-actions")).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await action.click({ trial: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole("button", { name: /Pause background|Background paused/ })).toHaveCount(0);
    await expect(page.locator('.cf-site-header-bar a[href="/signup"]')).toHaveCSS("background-color", "rgb(23, 23, 23)");
    await action.hover();
    await page.waitForTimeout(400); // Let the shared 360ms hover transition finish.
    await expect.poll(() => action.evaluate(node => {
      const style = getComputedStyle(node);
      const ctx = document.createElement("canvas").getContext("2d")!;
      const luminance = (color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => {
          const value = channel / 255;
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      };
      const foreground = luminance(style.color), background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    })).toBeGreaterThanOrEqual(4.5);
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
  await expect(page.locator(".ascii-layer")).toHaveCSS("background-color", "rgb(14, 11, 23)");
  await expect(page.locator(".lp-hero").getByRole("link", { name: "Build your first API" })).toBeVisible();
});
