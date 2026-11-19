import { test, expect } from "@playwright/test";

// These components belong to the previous landing page, which /preview/hero-relief still renders.
const OLD_LANDING = "/preview/hero-relief";

test("process navigation scrolls to the matching artifact and follows scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(OLD_LANDING);
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
    await page.goto(OLD_LANDING);
    for (const panel of await page.locator(".ol-process-panel").all()) {
      await panel.scrollIntoViewIfNeeded();
      await expect(panel.getByRole("heading", { level: 3 })).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    }
    await expect(page.locator("#build-story").getByRole("link", { name: "Inspect this result", exact: true })).toHaveAttribute("href", "/demo/library");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test("process descriptions interpolate open and closed, and reduced motion settles immediately", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(OLD_LANDING);
  const process = page.locator("#build-story");
  await process.getByRole("button", { name: "01 Describe", exact: true }).click();
  await expect(process.locator(".ol-process-reveal").first()).toHaveCSS("opacity", "1");
  await expect.poll(() => process.locator(".ol-process-reveal").first().evaluate(element => element.getAnimations().length)).toBe(0);
  const result = await process.evaluate(async element => {
    const buttons = element.querySelectorAll<HTMLButtonElement>(".ol-process-button");
    const first = buttons[0].querySelector<HTMLElement>(".ol-process-reveal")!;
    const second = buttons[1].querySelector<HTMLElement>(".ol-process-reveal")!;
    const initial = first.getBoundingClientRect().height;
    const selected = new Promise<void>(resolve => {
      const observer = new MutationObserver(() => {
        if (buttons[1].getAttribute("aria-current") !== "step") return;
        observer.disconnect();
        resolve();
      });
      observer.observe(buttons[1], { attributes: true, attributeFilter: ["aria-current"] });
    });
    buttons[1].click();
    await selected;
    // Seek the real transitions before the scroll observer's next frame can select
    // another chapter. A fixed frame window can miss interpolation on a slow GPU.
    const transitions = [first, second].map(reveal => reveal.getAnimations().find(animation =>
      animation instanceof CSSTransition && animation.transitionProperty === "grid-template-rows"));
    if (transitions.some(animation => !animation)) throw new Error("Both disclosure height transitions must run");
    for (const animation of transitions) {
      animation!.pause();
      animation!.currentTime = Number(animation!.effect!.getComputedTiming().duration) / 2;
    }
    const midpoint = { first: first.getBoundingClientRect().height, second: second.getBoundingClientRect().height };
    for (const animation of transitions) animation!.finish();
    return { initial, midpoint, closed: first.getBoundingClientRect().height, final: second.getBoundingClientRect().height };
  });
  expect(result.midpoint.first).toBeGreaterThan(0);
  expect(result.midpoint.first).toBeLessThan(result.initial - 1);
  expect(result.midpoint.second).toBeGreaterThan(0);
  expect(result.midpoint.second).toBeLessThan(result.final - 1);
  expect(result.closed).toBeLessThanOrEqual(1);
  await expect(process.getByRole("button", { name: "02 Plan", exact: true })).toHaveAttribute("aria-current", "step");
  await expect.poll(() => process.locator(".ol-process-reveal").nth(1).evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(process.locator(".ol-process-reveal").first()).toHaveCSS("opacity", "0");
  await expect(process.locator(".ol-process-reveal").nth(1)).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(process.locator(".ol-process-reveal").first()).toHaveCSS("transition-duration", "0s");
});
