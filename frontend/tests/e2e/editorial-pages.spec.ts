import { expect, test } from "@playwright/test";

for (const route of ["about", "how-it-works"]) {
  for (const width of [1440, 768, 375, 320]) {
    test(`${route} remains readable and navigable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (route === "how-it-works") {
        const stage = page.locator(".ed-stages details").first();
        await stage.locator("summary").click();
        await expect(stage).toHaveAttribute("open", "");
        await expect(stage.getByText("Structured requirements", { exact: true })).toBeVisible();
        await stage.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(stage).not.toHaveAttribute("open", "");
        await expect(page.locator(".cf-frame")).toContainText("Findings or failed tests → Coder");
        await expect(page.getByRole("link", { name: "Follow the process" })).toHaveAttribute("href", "#stages");
        const chapters = page.getByRole("navigation", { name: "Process chapters" });
        await expect(chapters.getByRole("link")).toHaveCount(3);
        await expect(chapters.getByRole("link", { name: /Inspect the result/ })).toHaveAttribute("href", "#evidence");
        await expect(page.locator("#evidence")).toHaveCount(1);
      } else {
        await expect(page.locator(".ed-facts")).toContainText("Your approval checkpoints");
        const proof = page.getByRole("region", { name: "Library demo source and test result" });
        await expect(proof).toContainText("8 passed in 1.42s");
        await expect(proof.getByRole("link")).toHaveAttribute("href", "/demo/library");
      }
      if (width === 1440 || width === 375) {
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo({ top: 0, behavior: "instant" });
        });
        await page.screenshot({ path: `/tmp/codeforge-${route}-${width}.png`, fullPage: true });
      }
    });
  }
}

test("public pages retain shared typography and contrasting controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const readStyle = () => page.locator(".lp-button").first().evaluate(el => { const s = getComputedStyle(el); return { font: s.fontFamily, background: s.backgroundColor, color: s.color }; });
  const control = await readStyle();
  expect(control.background).toBe("rgb(243, 246, 255)");
  expect(control.color).toBe("rgb(17, 23, 34)");
  const family = await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily);
  for (const route of ["about", "how-it-works"]) {
    await page.goto(`/${route}`);
    expect((await readStyle()).font).toBe(control.font);
    await expect(page.locator(".lp-button").first()).toHaveCSS("background-color", "rgb(23, 23, 23)");
    await expect(page.locator(".lp-button").first()).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily)).toBe(family);
  }
});

test("section colors span the page and stage disclosures animate in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const route of ["about", "how-it-works"]) {
    await page.goto(`/${route}`);
    for (const band of await page.locator("main > .ed-band").all()) {
      const bounds = await band.boundingBox();
      expect(bounds?.x).toBe(0);
      expect(bounds?.width).toBe(1440);
    }
  }
  const stage = page.locator(".ed-stages details").first();
  const summary = stage.locator("summary");
  const contentHeight = () => stage.evaluate(el => parseFloat(getComputedStyle(el, "::details-content").height));
  await summary.click();
  await expect.poll(contentHeight).toBeGreaterThan(0);
  await expect.poll(() => stage.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  const expanded = await contentHeight();
  await summary.click();
  const closing = await contentHeight();
  expect(closing).toBeGreaterThan(0);
  // Chromium may round interpolated auto heights differently by a subpixel.
  expect(closing).toBeLessThanOrEqual(expanded + 1);
  await expect.poll(contentHeight).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await summary.click();
  expect(await stage.evaluate(el => getComputedStyle(el, "::details-content").transitionDuration)).toBe("0s");
});
