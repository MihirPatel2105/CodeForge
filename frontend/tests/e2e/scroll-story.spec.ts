import { test, expect } from "@playwright/test";

test("scroll drives chapters in both directions and chapter buttons navigate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const story = page.locator(".cf-scroll-story");
  await story.scrollIntoViewIfNeeded();
  const bounds = await story.evaluate(element => ({ top: element.getBoundingClientRect().top + window.scrollY, distance: element.getBoundingClientRect().height - window.innerHeight }));
  for (const index of [0, 1, 2, 3, 1, 0]) {
    await page.evaluate(({ top, distance, index }) => window.scrollTo({ top: top + distance * ((index + 0.4) / 4), behavior: "instant" }), { ...bounds, index });
    await expect(story.locator("button").nth(index)).toHaveAttribute("aria-current", "step");
    await expect(story.locator(`[data-chapter="${index}"] h3`)).toBeVisible();
    await expect(story.locator(`[data-chapter="${index}"]`)).toHaveCSS("opacity", "1");
    await expect.poll(async () => Math.abs(await story.locator(".cf-story-sticky").evaluate(element => element.getBoundingClientRect().top))).toBeLessThan(2);
  }
  await story.getByRole("button", { name: "04 Verify" }).click();
  await expect(story.getByRole("button", { name: "04 Verify" })).toHaveAttribute("aria-current", "step");
  await expect(story.getByRole("link", { name: "Inspect the Library demo" })).toHaveAttribute("href", "/demo/library");
});

test("chapter transitions overlap without a blank frame", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const story = page.locator(".cf-scroll-story");
  await story.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const section = document.getElementById("build-story")!;
    window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top + (section.offsetHeight - window.innerHeight) * 0.5, behavior: "instant" });
  });
  // The native timeline can ease the two layers differently at the midpoint.
  // Both must contribute, with no gap in their combined opacity.
  for (const index of [1, 2]) {
    await expect.poll(() => story.locator(`[data-chapter="${index}"]`).evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.15);
    expect(await story.locator(`[data-chapter="${index}"]`).evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(0.85);
  }
  const totalOpacity = await story.evaluate(element => [1, 2].reduce((total, index) => total + Number(getComputedStyle(element.querySelector(`[data-chapter="${index}"]`)!).opacity), 0));
  expect(totalOpacity).toBeGreaterThan(0.95);
});

test("short desktop windows keep all chapters and the demo link reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const story = page.locator(".cf-scroll-story");
  await expect(story).toHaveAttribute("data-static", "true");
  for (const scene of await story.locator(".cf-story-scene").all()) {
    await expect(scene).toHaveAttribute("aria-hidden", "false");
    await expect(scene).toHaveCSS("opacity", "1");
  }
  const demo = story.getByRole("link", { name: "Inspect the Library demo" });
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toBeInViewport();
});

test("mobile presents all chapters in normal flow without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const story = page.locator(".cf-scroll-story");
  for (const heading of await story.locator("h3").all()) await expect(heading).toBeVisible();
  const layout = await story.evaluate(element => ({ width: element.scrollWidth, viewport: window.innerWidth, position: getComputedStyle(element.querySelector(".cf-story-sticky")!).position }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  expect(layout.position).toBe("relative");
  await expect(story.getByRole("navigation")).toBeHidden();
});

test("reduced motion keeps the entire story readable without sticky scenes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const story = page.locator(".cf-scroll-story");
  await expect(story).toHaveAttribute("data-reduced", "true");
  for (const scene of await story.locator(".cf-story-scene").all()) {
    await expect(scene).toBeVisible();
    await expect(scene).toHaveCSS("opacity", "1");
    await expect(scene).toHaveCSS("transform", "none");
  }
  await expect(story.locator(".cf-story-sticky")).toHaveCSS("position", "relative");
});
