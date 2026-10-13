import { expect, test } from "@playwright/test";

test("assembly machine builds, pauses, replays, and respects reduced motion", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install();
  await page.goto("/preview/api-machine");
  const scene = page.locator(".machine-canvas");
  await expect(scene).toHaveAttribute("data-rendered", "true");
  await expect(scene.locator("canvas")).toHaveCount(1);
  await page.clock.runFor(14000);
  await expect(page.locator(".machine-terminal code")).toHaveText("GET /books → 200 OK");
  await expect(page.locator(".machine-progress li[data-state=done]")).toHaveCount(5);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(5000);
  await expect(page.locator(".machine-terminal code")).toHaveText("GET /books → 200 OK");
  await page.screenshot({ path: testInfo.outputPath("api-machine-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Replay" }).click();
  await page.clock.runFor(100);
  await expect(page.locator(".machine-terminal code")).toHaveText("assembling models…");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
  await expect(page.locator(".machine-fallback")).toBeVisible();
  expect(errors).toEqual([]);
});

test("assembly preview fits mobile and provides a static WebGL fallback", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/api-machine");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath("api-machine-mobile.png"), fullPage: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.reload();
  await expect(page.locator(".machine-canvas")).toHaveAttribute("data-rendered", "false");
  await expect(page.locator(".machine-fallback")).toBeVisible();
});
