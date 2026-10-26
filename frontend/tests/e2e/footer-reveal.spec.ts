import { expect, test } from "@playwright/test";

for (const path of ["/", "/about", "/privacy", "/terms"]) test(`desktop footer reveals beneath ${path} and keyboard focus uncovers links`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/backend/auth/me", route => route.fulfill({ status: 401, json: {} }));
  await page.goto(path);
  const footer = page.getByRole("contentinfo");
  await expect(footer).toHaveAttribute("data-reveal", "true");
  const before = await footer.boundingBox();
  expect(before!.y + before!.height).toBeLessThanOrEqual(1001);
  const main = await page.locator("main").boundingBox();
  expect(main!.x).toBe(0);
  expect(main!.width).toBe(1440);
  // The reading column may be narrow; the sheet hiding the footer must span both edges.
  for (const x of [8, 1432]) {
    expect(await page.evaluate(x => Boolean(document.elementFromPoint(x, 300)?.closest("main")), x)).toBe(true);
  }
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), total - 1100);
  const partial = await footer.boundingBox();
  expect(Math.abs(partial!.y - before!.y)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Tab");
  await footer.getByRole("link", { name: "How it works", exact: true }).focus();
  await expect.poll(() => page.evaluate(() => Math.abs(document.documentElement.scrollHeight - innerHeight - scrollY))).toBeLessThanOrEqual(1);
  await expect(footer.getByRole("navigation", { name: "Product links" })).toBeVisible();
  for (const link of await footer.getByRole("navigation").getByRole("link").all()) {
    await expect(link).toHaveCSS("border-top-width", "0px");
    await expect(link).toHaveCSS("padding-left", "0px");
  }
  await expect(footer.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await page.screenshot({ path: "/tmp/codeforge-footer-desktop.png" });
});

for (const variant of ["mobile", "short", "reduced"] as const) {
  test(`footer stays in normal flow for ${variant}`, async ({ page }) => {
    await page.setViewportSize(variant === "mobile" ? { width: 375, height: 812 } : { width: 1440, height: variant === "short" ? 420 : 1000 });
    if (variant === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/faq");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveAttribute("data-reveal", "false");
    await expect(footer).toHaveCSS("position", "relative");
    await footer.getByRole("link", { name: "Terms of Use" }).scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link", { name: "Terms of Use" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(variant === "mobile" ? 375 : 1440);
    if (variant === "mobile") await page.screenshot({ path: "/tmp/codeforge-footer-mobile.png", fullPage: true });
  });
}

for (const path of ["/", "/about", "/privacy", "/terms"]) test(`refresh keeps the page opaque above the reveal footer on ${path}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await page.reload();
  await expect(page.getByRole("contentinfo")).toHaveAttribute("data-reveal", "true");
  const cover = await page.locator("main").evaluate(element => {
    // Rewind any active opacity entrance so the check catches a one-frame flash too.
    for (const animation of element.getAnimations()) {
      const effect = animation.effect;
      if (effect instanceof KeyframeEffect && effect.getKeyframes().some(frame => frame.opacity != null)) {
        animation.pause();
        animation.currentTime = 0;
      }
    }
    return getComputedStyle(element).opacity;
  });
  expect(cover).toBe("1");
});
