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
        // Six stages, each with what it receives and produces, under a sticky heading.
        const stages = page.locator("#stages .el-steps li");
        await expect(stages).toHaveCount(6);
        await expect(stages.first()).toContainText("Structured requirements");
        await expect(page.locator(".cf-frame")).toContainText("Findings or failed tests → Coder");
        await expect(page.getByRole("link", { name: "Follow the process" })).toHaveAttribute("href", "#stages");
        await expect(page.locator("#evidence")).toHaveCount(1);
        await expect(page.locator("#technology .em-list > div")).toHaveCount(4);
      } else {
        await expect(page.locator(".em-facts")).toContainText("Approval checkpoints for you");
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

test("public pages retain shared typography and contrasting controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const landingFamily = await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily);
  await page.goto("/about");
  const readStyle = () => page.locator(".el-primary").first().evaluate(el => { const s = getComputedStyle(el); return { font: s.fontFamily, background: s.backgroundColor, color: s.color }; });
  const control = await readStyle();
  // Slate ink button with ivory text on the cream hero (DESIGN.md button-primary).
  expect(control.background).toBe("rgb(20, 20, 19)");
  expect(control.color).toBe("rgb(250, 249, 245)");
  const family = await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily);
  expect(family).toBe(landingFamily);
  for (const route of ["how-it-works"]) {
    await page.goto(`/${route}`);
    expect((await readStyle()).font).toBe(control.font);
    await expect(page.locator(".el-primary").first()).toHaveCSS("background-color", control.background);
    await expect(page.locator(".el-primary").first()).toHaveCSS("color", control.color);
    expect(await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily)).toBe(family);
  }
});

test("pages sit on one full-width canvas and questions animate in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const route of ["faq", "contact", "about", "how-it-works", "privacy"]) {
    await page.goto(`/${route}`);
    const main = await page.locator("main").boundingBox();
    expect(main?.x, route).toBe(0);
    expect(main?.width, route).toBe(1440);
    await expect(page.locator("main"), route).toHaveCSS("background-color", "rgb(250, 249, 245)");
  }
  await page.goto("/faq");
  const question = page.getByRole("button", { name: "How long does a run take?", exact: true });
  await question.scrollIntoViewIfNeeded();
  const answer = page.locator(`[id="${await question.getAttribute("aria-controls")}"]`);
  const height = () => answer.evaluate(el => el.getBoundingClientRect().height);
  await question.click();
  await expect.poll(height).toBeGreaterThan(40);
  const expanded = await height();
  // Close and take the first height that differs from the open one, sampled every frame in one
  // browser task. A fixed 80 ms sample failed on a busy CI runner whose first animation frame
  // had not arrived yet (closing === expanded); an instant snap shut still reads 0 and fails.
  const closing = await question.evaluate(el => {
    const target = document.getElementById(el.getAttribute("aria-controls")!)!;
    const start = target.getBoundingClientRect().height;
    (el as HTMLElement).click();
    return new Promise<number>((resolve, reject) => {
      const deadline = performance.now() + 2000;
      const sample = () => {
        const current = target.getBoundingClientRect().height;
        if (current !== start) return resolve(current);
        if (performance.now() > deadline) return reject(new Error(`answer stayed at ${start}px after closing`));
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });
  expect(closing).toBeGreaterThan(0);
  expect(closing).toBeLessThan(expanded);
  await expect.poll(height).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(answer).toHaveCSS("transition-duration", "0s");
});

for (const width of [1440, 375]) {
  test(`contact fields stay readable and contained in their light panel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
      id: "contact-review", first_name: "Review", last_name: "Account", email: "review@example.test", is_admin: false,
    } }));
    await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
    await page.goto("/contact");
    const submit = page.getByRole("button", { name: "Send message", exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel("Phone", { exact: true }).fill("1234567890");
    await expect(page.getByLabel("Phone", { exact: true })).toHaveCSS("color", "rgb(20, 20, 19)");
    await page.getByLabel("Message", { exact: true }).fill("The report details are readable on this screen.");
    await expect(submit).toBeEnabled();
    const panel = await page.locator(".em-contact-form").boundingBox();
    const button = await submit.boundingBox();
    expect(panel).not.toBeNull();
    expect(button).not.toBeNull();
    expect(button!.y + button!.height).toBeLessThan(panel!.y + panel!.height - 12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
