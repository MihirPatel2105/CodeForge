import { expect, test } from "@playwright/test";

test("footer tech text responds to the pointer and restores static text for reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/faq");
  const wordmark = page.locator(".cf-footer-tech");
  await wordmark.scrollIntoViewIfNeeded();
  const canvas = wordmark.locator("canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(wordmark.locator(".cf-footer-tech-fallback")).toHaveCSS("visibility", "hidden");
  const before = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
  await canvas.hover();
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).not.toBe(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveCount(0);
  await expect(wordmark.locator(".cf-footer-tech-fallback")).toHaveCSS("visibility", "visible");
  await expect(wordmark).toHaveText("CodeForge");
});
