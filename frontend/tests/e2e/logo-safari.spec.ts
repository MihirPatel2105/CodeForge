import { existsSync } from "node:fs";
import { expect, test, webkit } from "@playwright/test";

// Safari regression: WebKit sized the logo's grid column from the lockup SVG's natural width
// (2285px) instead of its aspect ratio, so the side columns collapsed to 0px and the logo sat on
// top of Product and Demos. The suite otherwise runs in Chrome only, so this test drives WebKit
// itself and skips where it is not installed (`npx playwright install webkit`).

const webkitPath = (() => {
  try {
    return webkit.executablePath();
  } catch {
    return "";
  }
})();

test.skip(!webkitPath || !existsSync(webkitPath), "WebKit is not installed");

for (const path of ["/", "/about"]) test(`in Safari's engine the logo stays centred on ${path}`, async ({ baseURL }) => {
  // The config's `channel: "chrome"` is applied to every launch by default; WebKit has none.
  const browser = await webkit.launch({ channel: undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(new URL(path, baseURL).toString());
    await expect(page.locator(".lh-start .lh-pill").first()).toBeVisible();

    const layout = await page.evaluate(() => {
      const bar = document.querySelector(".lh-bar")!;
      const logo = bar.querySelector(".lh-logo")!.getBoundingClientRect();
      const lastMenu = [...bar.querySelectorAll(".lh-start .lh-pill")].at(-1)!.getBoundingClientRect();
      const columns = getComputedStyle(bar).gridTemplateColumns.split(" ").map(parseFloat);
      return { columns, logoLeft: logo.left, logoCentre: logo.left + logo.width / 2, lastMenuRight: lastMenu.right };
    });

    // Three real columns, the outer two equal: not "0px 1252px 0px".
    expect(layout.columns).toHaveLength(3);
    expect(layout.columns[0]).toBeGreaterThan(200);
    expect(Math.abs(layout.columns[0] - layout.columns[2])).toBeLessThanOrEqual(1);
    expect(layout.columns[1]).toBeLessThan(260);
    // The logo clears the menus and sits on the centre line.
    expect(layout.logoLeft).toBeGreaterThan(layout.lastMenuRight);
    expect(Math.abs(layout.logoCentre - 720)).toBeLessThanOrEqual(2);
  } finally {
    await browser.close();
  }
});
