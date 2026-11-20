import { expect, test, type Page } from "@playwright/test";

// The landing page's product film (components/marketing/product-film.tsx): it starts as a smaller
// panel and grows to full size as it scrolls into place, and a playing film pauses once the viewer
// scrolls away from it.

const stageScale = (page: Page) =>
  page.locator(".el-film-stage").evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 1 : new DOMMatrix(transform).a;
  });

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await page.waitForTimeout(700);
}

test("the film starts small and expands to full size as it scrolls into place", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".el-film-stage")).toBeAttached();

  // Just below the fold, it waits as a smaller panel.
  const filmTop = await page.locator(".el-film-frame").evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  await scrollTo(page, filmTop - 860);
  const small = await stageScale(page);
  expect(small).toBeLessThan(0.8);

  // Scrolled up to the top of the screen, it is full size.
  await scrollTo(page, filmTop - 120);
  await expect.poll(() => stageScale(page)).toBeGreaterThan(0.98);
});

test("a playing film pauses when the viewer scrolls away", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const film = page.locator(".el-film-video");
  await film.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Play the film/ }).click();

  await expect.poll(() => film.evaluate((video: HTMLVideoElement) => !video.paused && video.currentTime > 0), { timeout: 15_000 }).toBe(true);
  await expect(film).toHaveAttribute("controls", "");

  await scrollTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  await expect.poll(() => film.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
});
