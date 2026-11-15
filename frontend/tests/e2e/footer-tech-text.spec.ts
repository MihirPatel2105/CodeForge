import { expect, test, type Page } from "@playwright/test";

// The footer's large wordmark matches the logo: CODEFORGE in Roundex. The interactive TechText
// effect draws each letter from vector outlines (footer-wordmark-glyphs.json), and the static
// fallback is the outline SVG, so the site never serves the Roundex font file itself.
const WORDMARK_RATIO = 1809 / 201;

function watchFontRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/roundex|\.otf(\?|$)/i.test(request.url())) requests.push(request.url());
  });
  return requests;
}

test("the footer wordmark animates from outlines and responds to the pointer", async ({ page }) => {
  const fontRequests = watchFontRequests(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/faq");
  const wordmark = page.locator(".cf-footer-tech");
  await wordmark.scrollIntoViewIfNeeded();

  const canvas = wordmark.locator("canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(wordmark.locator(".cf-footer-wordmark-art")).toHaveCSS("visibility", "hidden");
  // The letters are actually drawn: the canvas is not blank.
  const inked = await canvas.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext("2d")!.getImageData(0, 0, node.width, node.height).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
    return count;
  });
  expect(inked).toBeGreaterThan(1000);

  const before = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
  await canvas.hover();
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).not.toBe(before);
  expect(fontRequests).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`with reduced motion the footer shows the static outline wordmark at ${width}px`, async ({ page }) => {
    const fontRequests = watchFontRequests(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/faq");
    const wordmark = page.locator(".cf-footer-wordmark");
    await wordmark.scrollIntoViewIfNeeded();

    await expect(wordmark.locator("canvas")).toHaveCount(0);
    const art = wordmark.locator("[data-wordmark]");
    await expect(art).toHaveAttribute("data-wordmark", "v4");
    await expect(art).toHaveCSS("visibility", "visible");
    expect(await art.evaluate((node) => getComputedStyle(node).maskImage || getComputedStyle(node).webkitMaskImage))
      .toContain("codeforge-wordmark-v4.svg");
    const [box, footer] = await Promise.all([art.boundingBox(), page.locator("footer").boundingBox()]);
    expect(box!.width / box!.height).toBeCloseTo(WORDMARK_RATIO, 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(footer!.x + footer!.width);
    expect(fontRequests).toEqual([]);
  });
}
