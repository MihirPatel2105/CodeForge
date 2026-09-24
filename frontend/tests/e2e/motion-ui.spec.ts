import { expect, test } from "@playwright/test";

test("sections reveal on scroll and reduced motion keeps content visible", async ({ page }) => {
  await page.goto("/");

  const stack = page.locator("#stack");
  await expect(stack).toHaveAttribute("data-cf-reveal-pending", "");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("smooth");

  await stack.scrollIntoViewIfNeeded();
  await expect(stack).toHaveAttribute("data-cf-reveal-visible", "");
  await expect(stack).toHaveCSS("opacity", "1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  await expect(page.locator("main > section[data-cf-reveal-pending]")).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});
