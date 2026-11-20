import { expect, test, type Page } from "@playwright/test";

// The sample replay (components/marketing/landing-product-preview.tsx) plays the scripted Library
// demo through the product's own reducer. The home page now shows the product film in its place,
// so these checks run on the preview page that still renders the replay.
// The fake clock drives playback, so these checks never wait on real time.
const REPLAY_PAGE = "/preview/hero-relief";

// One replay tick. Stepping by ticks fires each scheduled event without simulating every
// animation frame of the landing page, which `clock.runFor` would do far more slowly.
const TICK_MS = 700;
const FULL_REPLAY_MS = 45_000;

function workspace(page: Page) {
  return page.getByRole("region", { name: "CodeForge sample replay" });
}

async function openLanding(page: Page, height = 1000) {
  // An installed clock still flows in real time; pause it before the page loads so only
  // `advance` moves the replay, otherwise a slow runner drifts past what a test checks.
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.setViewportSize({ width: 1440, height });
  await page.goto(REPLAY_PAGE);
}

async function revealWorkspace(page: Page) {
  await workspace(page).scrollIntoViewIfNeeded();
  // Visibility is reported by the browser in real time; wait for it before stepping the clock.
  await expect(workspace(page)).toHaveAttribute("data-on-screen", "true");
}

async function advance(page: Page, ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
    await page.clock.fastForward(TICK_MS);
  }
}

async function advanceUntil(page: Page, done: () => Promise<boolean>, limitMs = FULL_REPLAY_MS) {
  for (let elapsed = 0; elapsed < limitMs; elapsed += TICK_MS) {
    if (await done()) return;
    await page.clock.fastForward(TICK_MS);
  }
  throw new Error("The replay never reached the expected point");
}

test("replay starts only once the workspace is on screen", async ({ page }) => {
  await openLanding(page, 420);
  const pm = workspace(page).getByRole("button", { name: /^PM/ });
  await advance(page, 10_000);
  await expect(pm).toHaveAttribute("data-state", "idle");

  await revealWorkspace(page);
  await advance(page, 10_000);
  await expect(pm).toHaveAttribute("data-state", "done");
});

test("replay walks the pipeline to a passing sandbox result", async ({ page }) => {
  await openLanding(page);
  await revealWorkspace(page);
  const region = workspace(page);

  await advance(page, FULL_REPLAY_MS);

  for (const stage of ["PM", "Architect", "Coder", "Reviewer", "Tester", "Sandbox"]) {
    await expect(region.getByRole("button", { name: new RegExp(`^${stage}`) })).toHaveAttribute("data-state", "done");
  }
  await expect(region.getByRole("status")).toContainText("8 of 8 tests passed");
});

test("a stage chip shows what that agent produced", async ({ page }) => {
  await openLanding(page);
  await revealWorkspace(page);
  await advance(page, FULL_REPLAY_MS);
  const region = workspace(page);

  const reviewer = region.getByRole("button", { name: /^Reviewer/ });
  await reviewer.click();
  await expect(reviewer).toHaveAttribute("aria-pressed", "true");
  await expect(region.locator(".ol-hero-stage-detail")).toContainText("Reviewer");
  await expect(region.locator(".ol-hero-stage-detail")).toContainText("0 findings, 0 blocking");
});

test("the repair loop rewrites main.py and the file tab shows both versions", async ({ page }) => {
  await openLanding(page);
  await revealWorkspace(page);
  const region = workspace(page);
  const status = region.getByRole("status");

  // The Reviewer has sent its blocking finding back; the Coder has not rewritten yet.
  await advanceUntil(page, async () => (await status.textContent())?.includes("sent back to the Coder") ?? false);
  await region.getByRole("tab", { name: "main.py", exact: true }).click();
  await expect(region.getByRole("tabpanel", { name: "main.py", exact: true })).not.toContainText("response_model=BookOut");

  await advance(page, FULL_REPLAY_MS);
  await expect(region.getByRole("tabpanel", { name: "main.py", exact: true })).toContainText("response_model=BookOut");
  await expect(region.getByRole("tabpanel", { name: "main.py", exact: true })).toContainText("Updated in pass 2");
});

test("pause holds the replay and replay restarts it", async ({ page }) => {
  await openLanding(page);
  await revealWorkspace(page);
  const region = workspace(page);
  const sandbox = region.getByRole("button", { name: /^Sandbox/ });

  await advance(page, 3_000);
  await region.getByRole("button", { name: "Pause replay" }).click();
  // A held replay would have moved several stages in this time.
  await advance(page, 5_000);
  await expect(sandbox).toHaveAttribute("data-state", "idle");

  await region.getByRole("button", { name: "Play replay" }).click();
  await advanceUntil(page, async () => (await sandbox.getAttribute("data-state")) === "done");

  await region.getByRole("button", { name: "Replay from start" }).click();
  await expect(sandbox).toHaveAttribute("data-state", "idle");
});

test("reduced motion shows the finished run without autoplay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLanding(page);
  const region = workspace(page);

  await expect(region.getByRole("button", { name: /^Sandbox/ })).toHaveAttribute("data-state", "done");
  await expect(region.getByRole("status")).toContainText("8 of 8 tests passed");
  await expect(region.getByRole("button", { name: "Replay from start" })).toBeVisible();
});

test("the hero labels the replay honestly and links to the full run", async ({ page }) => {
  await openLanding(page);
  const shell = page.locator(".ol-product-shell");
  await expect(shell).toContainText("Sample replay");
  await expect(shell).not.toContainText("Recorded");
  await expect(shell.getByRole("link", { name: /Open the full run/ })).toHaveAttribute("href", "/demo/library");
});

for (const width of [390, 320]) {
  test(`the workspace fits without horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(REPLAY_PAGE);
    await workspace(page).scrollIntoViewIfNeeded();
    await expect(workspace(page).getByRole("tab", { name: "main.py", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("the repair loop is called out and the rewritten lines are marked", async ({ page }) => {
  await openLanding(page);
  await revealWorkspace(page);
  const region = workspace(page);

  await expect(region.locator(".ol-hero-loop")).toHaveCount(0);
  await advance(page, FULL_REPLAY_MS);

  await expect(region.locator(".ol-hero-loop")).toContainText("Repair loop");
  await region.getByRole("tab", { name: "main.py", exact: true }).click();
  const panel = region.getByRole("tabpanel", { name: "main.py", exact: true });
  await expect(panel.locator("[data-changed]")).not.toHaveCount(0);
  await expect(panel.locator("[data-changed]").first()).toContainText("response_model=BookOut");
});

test("the replay clock and progress advance with the run", async ({ page }) => {
  await openLanding(page);
  await revealWorkspace(page);
  const clock = workspace(page).locator(".ol-hero-clock");

  await expect(clock).toHaveText(/^0:00 \/ \d:\d\d$/);
  await advance(page, FULL_REPLAY_MS);
  const [elapsed, total] = (await clock.textContent())!.split(" / ");
  expect(elapsed).toBe(total);
});

for (const width of [1440, 390]) {
  test(`the card keeps one height across files and replay stages at ${width}px`, async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(REPLAY_PAGE);
    await revealWorkspace(page);
    const region = workspace(page);
    const shell = page.locator(".ol-product-shell");
    const heights = new Set<number>();
    const measure = async () => heights.add(await shell.evaluate((element) => (element as HTMLElement).offsetHeight));

    for (let step = 0; step < 80; step++) {
      await measure();
      await page.clock.fastForward(TICK_MS);
    }
    for (const path of ["models.py", "schemas.py", "main.py", "test_main.py"]) {
      await region.getByRole("tab", { name: path, exact: true }).click();
      await measure();
    }
    await region.getByRole("button", { name: "Replay from start" }).click();
    await measure();

    expect([...heights]).toHaveLength(1);
  });
}
