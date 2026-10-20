import { expect, test } from "@playwright/test";

for (const width of [1440, 375]) {
  test(`missing pages show recovery links and the Arc illustration at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toContainText("This page is off the map.");
    await expect(main.getByText("The link may have changed, or the page no longer exists.")).toBeVisible();
    await expect(main.locator('svg[aria-hidden="true"]').first()).toBeVisible();
    await expect(main.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/projects");
    await expect(main.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/codeforge-404-${width}.png` });
    await main.getByRole("link", { name: "Go home" }).click();
    await expect(page).toHaveURL("/");
  });
}
