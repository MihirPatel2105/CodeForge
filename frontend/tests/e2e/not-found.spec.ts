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

test("map route animates and stops with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/this-page-does-not-exist");
  const illustration = page.getByRole("main").locator("svg").first();
  const route = illustration.locator("clipPath rect");
  const firstWidth = await route.evaluate((node) => parseFloat(getComputedStyle(node).width));
  await expect.poll(() => route.evaluate((node) => parseFloat(getComputedStyle(node).width))).not.toBe(firstWidth);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => illustration.locator("g").first().evaluate((node) => getComputedStyle(node).transform)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
});
