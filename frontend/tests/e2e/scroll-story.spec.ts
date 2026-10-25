import { test, expect } from "@playwright/test";

test("process navigation scrolls to the matching artifact and follows scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const process = page.locator("#build-story");
  await process.scrollIntoViewIfNeeded();
  for (const index of [0, 1, 2, 3, 1, 0]) {
    const button = process.getByRole("button").nth(index);
    await button.click();
    await expect(page.locator(`#process-${index}`)).toBeInViewport();
    await expect(button).toHaveAttribute("aria-current", "step");
  }
  await page.locator("#process-2").scrollIntoViewIfNeeded();
  await expect(process.getByRole("button", { name: "03 Build", exact: true })).toHaveAttribute("aria-current", "step");
  await expect(process.getByRole("link", { name: "Inspect the Library demo" })).toHaveAttribute("href", "/demo/library");
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
  test(`all process artifacts stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    for (const panel of await page.locator(".ol-process-panel").all()) {
      await panel.scrollIntoViewIfNeeded();
      await expect(panel.getByRole("heading", { level: 3 })).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    }
    await expect(page.locator("#build-story").getByRole("link", { name: "Build your first API", exact: true })).toHaveAttribute("href", "/signup");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
