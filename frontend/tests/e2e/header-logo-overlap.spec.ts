import { expect, test, type Page } from "@playwright/test";

// The header logo must never sit on top of the site menu (Product, Demos, Company): not at
// any window width, and not while it moves between pages.

async function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bar = document.querySelector(".lh-bar")!;
    const logo = bar.querySelector(".lh-logo")!.getBoundingClientRect();
    return [...bar.querySelectorAll(".lh-start .lh-pill")]
      .filter((pill) => getComputedStyle(pill).display !== "none")
      .map((pill) => ({ text: (pill.textContent ?? "").trim(), box: pill.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.left < logo.right && box.right > logo.left)
      .map(({ text }) => text);
  });
}

/** Every visible item in the bar (logo, menus, buttons) that touches another one. */
async function crowded(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll(".lh-bar .lh-logo, .lh-bar .lh-pill")]
      .filter((el) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0)
      .map((el) => ({ text: (el.textContent ?? "").trim() || "logo", box: el.getBoundingClientRect() }));
    const pairs: string[] = [];
    items.forEach((a, i) => items.slice(i + 1).forEach((b) => {
      if (a.box.left < b.box.right - 1 && b.box.left < a.box.right - 1) pairs.push(`${a.text} / ${b.text}`);
    }));
    return pairs;
  });
}

for (const width of [700, 768, 820, 900, 960, 1100, 1440]) {
  test(`the logo clears the site menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    await expect(page.locator(".lh-start .lh-pill").first()).toBeVisible();
    expect(await overlaps(page)).toEqual([]);
    expect(await crowded(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("coming home from the demo, the logo does not glide across the menu", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/demo/library");
  await expect(page.locator(".lh-logo")).toHaveAttribute("data-logo-left", "");
  await page.locator(".lh-logo").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".lh-start .lh-pill").first()).toBeVisible();
  // Sample the first moments on the new page, while any glide would still be under way.
  for (let sample = 0; sample < 8; sample += 1) {
    expect(await overlaps(page), `sample ${sample}`).toEqual([]);
    await page.waitForTimeout(100);
  }
});
