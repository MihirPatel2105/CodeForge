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
      } else {
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

test("public pages reuse homepage typography and primary controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const readStyle = () => page.locator(".lp-button").first().evaluate(el => { const s = getComputedStyle(el); return { color: s.color, background: s.backgroundColor, radius: s.borderRadius, font: s.fontFamily }; });
  const control = await readStyle();
  const family = await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily);
  for (const route of ["about", "how-it-works"]) {
    await page.goto(`/${route}`);
    expect(await readStyle()).toEqual(control);
    expect(await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily)).toBe(family);
  }
});
