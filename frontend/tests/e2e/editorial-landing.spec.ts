import { expect, test } from "@playwright/test";

// The home page below the unchanged hero: docs/design/ANTHROPIC_DESIGN.md.

test("every hero index link lands on its section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const [label, heading] of [
    ["Meet the team", "#el-stages-title"],
    ["The build, step by step", "#el-steps-title"],
    ["The repair loop", "#el-loop-title"],
    ["Example APIs", "#el-examples-title"],
    ["Questions", "#el-faq-title"],
  ]) {
    await page.locator("#overview").getByRole("link", { name: new RegExp(label) }).click();
    await expect(page.locator(heading), label).toBeInViewport();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
});

test("questions open and close smoothly, and switch at once with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const question = page.getByRole("button", { name: "What do I get at the end?", exact: true });
  await question.scrollIntoViewIfNeeded();
  const answer = page.locator(`[id="${await question.getAttribute("aria-controls")}"]`);
  await expect(answer).toHaveAttribute("inert", "");
  await expect(answer).toHaveCSS("height", "0px");

  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  // Part-way through, the answer is taller than closed but shorter than fully open.
  const midway = await answer.evaluate(element => new Promise<number>(resolve => setTimeout(() => resolve(element.getBoundingClientRect().height), 90)));
  await expect.poll(() => answer.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(midway);
  expect(midway).toBeGreaterThan(0);
  await expect(answer.getByText(/download the project/)).toBeVisible();
  await expect(answer).not.toHaveAttribute("inert");

  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => answer.evaluate(element => element.getBoundingClientRect().height)).toBe(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(answer).toHaveCSS("transition-duration", "0s");
});

test("sections stay visible when JavaScript does not run", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".el-statement")).toHaveCSS("opacity", "1");
  await expect(page.locator("#how .el-card").first()).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { name: "What will you build?" })).toBeVisible();
  await context.close();
});
