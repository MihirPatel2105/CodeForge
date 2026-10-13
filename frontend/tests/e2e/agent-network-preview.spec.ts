import { expect, test } from "@playwright/test";

test("3D preview renders, pauses, and supports agent selection", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/preview/agent-network");
  const scene = page.locator(".network-scene");
  await expect(scene).toHaveAttribute("data-animated", "true");
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(scene.locator(".network-node-label").first()).toHaveAttribute("style", /transform/);
  await page.screenshot({ path: testInfo.outputPath("agent-network-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "03 Coder" }).click();
  await expect(page.locator(".network-agent-description")).toHaveText("Builds the endpoints and the logic behind them.");
  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(scene.locator("canvas")).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-animated", "false");
  await page.getByRole("button", { name: "Play motion" }).click();
  await expect(scene.locator("canvas")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause motion" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("static preview stays accessible on narrow screens and without WebGL", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/agent-network");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".network-scene canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "05 Tester" }).click();
  await expect(page.locator(".network-agent-description")).toHaveText("Exercises the API and reports what passes.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.reload();
  await expect(page.locator(".network-scene")).toHaveAttribute("data-animated", "false");
  await expect(page.locator(".network-static")).toBeVisible();
});
