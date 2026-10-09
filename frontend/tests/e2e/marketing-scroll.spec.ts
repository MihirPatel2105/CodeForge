import { expect, test } from "@playwright/test";

test("marketing wheel scrolling eases and reacts to motion preferences", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/lenis/);
  await expect(html).toHaveCSS("scroll-behavior", "auto");
  await page.mouse.move(10, 300);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(450);
  await expect.poll(() => html.getAttribute("class")).not.toMatch(/lenis-scrolling/);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(html).not.toHaveClass(/lenis/);
  await expect(html).toHaveCSS("scroll-behavior", "auto");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(html).toHaveClass(/lenis/);

  // Client navigation must destroy the shared window scroll controller.
  await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(html).not.toHaveClass(/lenis/);
  await page.goBack();
  await expect(html).toHaveClass(/lenis/);
});

for (const route of ["/about", "/how-it-works"]) {
  test(`${route} enables momentum and respects reduced motion on load`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("html")).toHaveClass(/lenis/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
  });
}
