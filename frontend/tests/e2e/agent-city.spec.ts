import { expect, test } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";
import { bugs } from "../../app/playground/agent-city/city-data";

test("walk the five-agent quest, save progress, and restart", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install();
  await page.goto("/playground/agent-city");
  await expect(page.locator(".city-world")).toHaveAttribute("data-status", "ready");
  await expect(page.locator(".city-world canvas")).toHaveCount(1);
  await page.clock.runFor(100);
  await page.screenshot({ path: testInfo.outputPath("agent-city-day.png"), fullPage: true });
  await page.getByRole("button", { name: "Pick up an idea" }).click();
  const actions = ["Approve requirements", "Approve the plan", "Assemble the service", "Apply the review", "Run the quest tests"];
  const names = ["PM", "Architect", "Coder", "Reviewer", "Tester"];
  for (let i = 0; i < names.length; i++) {
    await page.getByRole("button", { name: `Visit ${names[i]}`, exact: true }).click();
    await page.clock.runFor(4500);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: `Hey, I’m the ${names[i]}.` })).toBeVisible();
    if (i === 0) await page.getByRole("radio", { name: "Task API" }).check();
    if (i === 1) await expect(page.locator(".city-artifact")).toContainText("/tasks");
    await page.getByRole("button", { name: actions[i], exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "An idea became an API." })).toBeVisible();
  await expect(page.locator(".city-artifact")).toContainText("GET /tasks → 200 OK");
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your API made it home." })).toBeVisible();
  await page.getByRole("button", { name: "Switch to evening" }).click();
  await page.clock.runFor(100);
  await expect(page.locator(".agent-city")).toHaveAttribute("data-night", "true");
  await page.screenshot({ path: testInfo.outputPath("agent-city-evening.png"), fullPage: true });
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pick up an idea" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile movement controls, pause, and reduced motion remain usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/playground/agent-city");
  await expect(page.locator(".city-world")).toHaveAttribute("data-status", "ready");
  await page.clock.runFor(100);
  await page.screenshot({ path: testInfo.outputPath("agent-city-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "Pause island" }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Walk forward" })).toBeDisabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Pick up an idea" }).click();
  await page.getByRole("button", { name: "Visit PM", exact: true }).click();
  await page.clock.runFor(4000);
  await expect(page.getByRole("button", { name: "Approve requirements" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Walk forward" })).toBeEnabled();
  await page.locator(".city-world canvas").press("e");
  await expect(page.getByRole("heading", { name: "Hey, I’m the PM." })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("the quest is playable when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/playground/agent-city");
  await expect(page.locator(".city-world")).toHaveAttribute("data-status", "fallback");
  await page.getByRole("button", { name: "Pick up an idea" }).click();
  const steps = [["PM","Approve requirements"],["Architect","Approve the plan"],["Coder","Assemble the service"],["Reviewer","Apply the review"],["Tester","Run the quest tests"]];
  for (const [name,action] of steps) {
    await page.getByRole("button", { name: `Visit ${name}`, exact: true }).click();
    await page.getByRole("button", { name: action, exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "An idea became an API." })).toBeVisible();
});

test("click-to-walk discovers the bugs and the hidden coffee nook", async ({ page }) => {
  await page.clock.install();
  await page.goto("/playground/agent-city");
  await expect(page.locator(".city-world")).toHaveAttribute("data-status", "ready");
  const canvas = page.locator(".city-world canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Island canvas is unavailable");
  // Project known landmarks into the fixed isometric view, then use real pointer input.
  const aspect = bounds.width / bounds.height;
  const halfWidth = Math.max(15.2, aspect * 10.8);
  const camera = new OrthographicCamera(-halfWidth, halfWidth, halfWidth/aspect, -halfWidth/aspect, 0.1, 120);
  camera.position.set(22,24,27); camera.lookAt(0,0,0); camera.updateMatrixWorld();
  const clickLandmark = async (x: number, y: number, z: number) => {
    const point = new Vector3(x,y,z).project(camera);
    await canvas.click({ position: { x: (point.x+1)*bounds.width/2, y: (1-point.y)*bounds.height/2 } });
    await page.clock.runFor(6000);
  };
  await page.clock.runFor(100);
  await clickLandmark(-2.9,0.65,2.6);
  await expect(page.getByRole("heading", { name: "The unofficial sixth agent." })).toBeVisible();
  await page.getByRole("button", { name: "Back to the island" }).click();
  await expect(page.locator(".city-collectibles")).toContainText("Nook found");
  for (let i = 0; i < bugs.length; i++) {
    await clickLandmark(bugs[i].x,0.45,bugs[i].z);
    await expect(page.locator(".city-collectibles")).toContainText(`${i+1}/3 bugs`);
  }
});

test("camera drag preserves clicks and reset restores the view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/playground/agent-city");
  await expect(page.locator(".city-world")).toHaveAttribute("data-status", "ready");
  const canvas = page.locator(".city-world canvas");
  await page.getByRole("button", { name: "Reset camera view" }).click();
  const original = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 140, bounds.y + bounds.height / 2 + 35, { steps: 12 });
  await page.mouse.up();
  expect((await canvas.screenshot()).equals(original)).toBe(false);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Reset camera view" }).click();
  expect((await canvas.screenshot()).equals(original)).toBe(true);
});
