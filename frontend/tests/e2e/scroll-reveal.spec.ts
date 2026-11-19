import { expect, test } from "@playwright/test";

// These components belong to the previous landing page, which /preview/hero-relief still renders.
const OLD_LANDING = "/preview/hero-relief";

for (const width of [1440, 390]) {
  test(`landing headings reveal with scroll and reverse at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(OLD_LANDING);
    const title = page.getByRole("heading", { name: "See what a finished API looks like.", exact: true });
    const words = title.locator("[data-reveal-word]");
    await expect(words).toHaveCount(7);
    await expect(words.last()).toHaveCSS("opacity", "0.1");
    await title.evaluate(node => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - window.innerHeight + node.clientHeight + 20, behavior: "instant" }));
    await expect(words.last()).toHaveCSS("opacity", "1");
    await expect(words.last()).toHaveCSS("filter", "none");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(words.last()).toHaveCSS("opacity", "0.1");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(words.first()).toHaveCSS("opacity", "1");
    await expect(words.first()).toHaveCSS("filter", "none");
    await expect(title).toHaveCSS("transform", "none");
  });
}
