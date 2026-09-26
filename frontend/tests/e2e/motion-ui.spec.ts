import { expect, test } from "@playwright/test";

test("all sections are available before scrolling and reduced motion stays still", async ({ page }) => {
  await page.goto("/");

  const stack = page.locator("#stack");
  await expect(stack).toBeAttached();
  await expect(stack).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("smooth");

  await stack.scrollIntoViewIfNeeded();
  await expect(stack.getByRole("heading", { name: "What it runs on" })).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByText("10/10")).toBeVisible();
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});
