import { expect, test, type Page } from "@playwright/test";

const PREVIEW = "/";

/** Scroll, then let the bar's frame-throttled listener see this position before the next one. */
async function scrollTo(page: Page, y: number) {
  await page.evaluate(async (top) => {
    window.scrollTo({ top, behavior: "instant" });
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, y);
}

/** Open the preview and wait until the bar's scroll listener is attached. */
async function openPreview(page: Page) {
  await page.goto(PREVIEW);
  await expect(page.locator("[data-launch-header][data-ready]")).toHaveCount(1);
}

async function heroBottom(page: Page) {
  return page.locator("#overview").evaluate((hero) => hero.getBoundingClientRect().bottom + window.scrollY);
}

test("hero states the product and links each numbered section to a real target", async ({ page }) => {
  await openPreview(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/From an idea\s*to a tested API/);
  const contents = page.getByRole("navigation", { name: "On this page" }).getByRole("link");
  await expect(contents).toHaveCount(5);
  for (const href of await contents.evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
    await expect(page.locator(href!)).toHaveCount(1);
  }
});

test("wordmark collapses to the mark once the page starts to scroll", async ({ page }) => {
  await openPreview(page);
  const logo = page.getByRole("banner").getByRole("link", { name: "CodeForge home" });

  await expect(logo).not.toHaveAttribute("data-collapsed", "");
  await scrollTo(page, 200);
  await expect(logo).toHaveAttribute("data-collapsed", "");
  await scrollTo(page, 0);
  await expect(logo).not.toHaveAttribute("data-collapsed", "");
});

test("top bar changes tone past the hero, hides on the way down and returns on the way up", async ({ page }) => {
  await openPreview(page);
  const header = page.locator("[data-launch-header]");
  await expect(header).toHaveAttribute("data-tone", "hero");
  // Over the hero the bar has no surface of its own; past it, it takes the page's colour.
  await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  const bottom = await heroBottom(page);
  await scrollTo(page, bottom + 200);
  await expect(header).toHaveAttribute("data-tone", "page");
  const pageColour = await page.locator(".cf-premium").evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(header).toHaveCSS("background-color", pageColour);
  await scrollTo(page, bottom + 180);
  await expect(header).not.toHaveAttribute("data-hidden", "");

  await scrollTo(page, bottom + 220);
  await expect(header).toHaveAttribute("data-hidden", "");
  await scrollTo(page, bottom + 190);
  await expect(header).not.toHaveAttribute("data-hidden", "");
});

test("a keyboard user can always reach the bar, even while it is hidden", async ({ page }) => {
  await openPreview(page);
  const header = page.locator("[data-launch-header]");
  const bottom = await heroBottom(page);
  await scrollTo(page, bottom + 200);
  await expect(header).toHaveAttribute("data-tone", "page");
  await scrollTo(page, bottom + 600);
  await expect(header).toHaveAttribute("data-hidden", "");

  await page.getByRole("banner").getByRole("link", { name: "CodeForge home" }).focus();
  await expect.poll(() => header.evaluate((bar) => Math.round(bar.getBoundingClientRect().top))).toBe(0);
});

test("fits a phone without sideways scrolling and stills the animation on request", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPreview(page);

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // The hero clips overflow, so a cut-off title would not show up as page scroll.
    const edges = await page.locator(".lh-title span").evaluateAll((lines) => lines.map((line) => {
      const box = line.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
    for (const edge of edges) {
      expect(edge.left).toBeGreaterThanOrEqual(0);
      expect(edge.right).toBeLessThanOrEqual(width);
    }
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await expect(page.locator(".lh-world")).toHaveAttribute("data-state", "still");
  await expect(page.locator(".lh-loop-label")).toHaveCount(0);
});

test("entrance runs horizon first, then the headline, and the bar arrives last", async ({ page }) => {
  // Hold every animation at its start from the first frame, so a slow page cannot finish the
  // entrance in real time before the test seeks through it.
  await page.addInitScript(() => {
    const hold = () => {
      for (const animation of document.getAnimations()) if (animation.playState === "running") animation.pause();
      if (!document.documentElement.dataset.entranceSeek) requestAnimationFrame(hold);
    };
    requestAnimationFrame(hold);
  });
  await page.goto(PREVIEW);
  const header = page.locator("[data-launch-header]");
  const opacity = (selector: string) => page.locator(selector).first().evaluate((el) => Number(getComputedStyle(el).opacity));
  const barTop = () => header.evaluate((bar) => Math.round(bar.getBoundingClientRect().bottom));
  // The entrance is pure CSS, which the fake clock does not drive: seek every animation instead.
  const seek = (ms: number) => page.evaluate((time) => {
    document.documentElement.dataset.entranceSeek = "on";
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
  }, ms);

  // 600ms in: the horizon is rising, the words and the bar have not started.
  await seek(600);
  expect(await opacity(".lh-world")).toBeGreaterThan(0);
  expect(await opacity(".lh-title span")).toBe(0);
  expect(await barTop()).toBeLessThanOrEqual(0);

  // 3.2s in: everything has landed.
  await seek(3200);
  expect(await opacity(".lh-title span")).toBe(1);
  expect(await opacity(".lh-toc li:last-child")).toBe(1);
  expect(await barTop()).toBeGreaterThan(0);
});

test("keyboard focus mid-entrance brings the bar in without replaying its slide", async ({ page }) => {
  await page.goto(PREVIEW);
  const header = page.locator("[data-launch-header]");
  const logo = page.getByRole("banner").getByRole("link", { name: "CodeForge home" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await logo.focus();
  await expect.poll(() => header.evaluate((bar) => Math.round(bar.getBoundingClientRect().top))).toBe(0);
  await page.locator("#overview").focus();
  // Leaving the bar must not send it back off screen for another two seconds.
  await page.waitForTimeout(150);
  expect(await header.evaluate((bar) => Math.round(bar.getBoundingClientRect().top))).toBe(0);
});

test("the sun keeps its own course and does not follow the pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPreview(page);
  const sky = page.locator(".lh-world");
  await expect(sky).toHaveAttribute("data-sun-target", /-?\d/);
  const aim = async () => Number(await sky.getAttribute("data-sun-target"));

  // The sun starts left of centre. A pointer on the far right must not pull it across.
  for (const x of [1300, 140, 1300]) {
    await page.mouse.move(x, 420, { steps: 5 });
    await page.waitForTimeout(400);
    expect(await aim()).toBeLessThan(-0.1);
  }
});

test("the looping light pauses once the hero is scrolled away", async ({ page }) => {
  await openPreview(page);
  const bottom = await heroBottom(page);
  await scrollTo(page, bottom + 200);
  await expect(page.locator(".lh-world")).toHaveAttribute("data-state", "paused");
  await scrollTo(page, 0);
  await expect(page.locator(".lh-world")).toHaveAttribute("data-state", "running");
});

test("the horizon carries no agent markers, only the lit arc", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PREVIEW);
  await expect(page.locator("#overview")).toHaveAttribute("data-webgl", "on");
  await expect(page.locator(".lh-node-label, .lh-beacon")).toHaveCount(0);
  // One invisible anchor remains for the sky canvas to measure the arc from.
  await expect(page.locator(".lh-anchor")).toHaveCSS("visibility", "hidden");
});

test("with reduced motion every part of the hero is in place at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PREVIEW);

  for (const selector of [".lh-world", ".lh-title span", ".lh-eyebrow", ".lh-toc li"]) {
    await expect(page.locator(selector).first()).toHaveCSS("opacity", "1");
  }
  expect(await page.locator("[data-launch-header]").evaluate((bar) => bar.getBoundingClientRect().top)).toBe(0);
});

test("the headline and contents keep Fable's compact proportions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const size = await page.locator(".lh-title").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(70);
  expect(size).toBeLessThanOrEqual(80);
  const rows = page.locator(".lh-toc a");
  const [a, b] = await Promise.all([rows.nth(0).boundingBox(), rows.nth(1).boundingBox()]);
  expect(b!.y - a!.y).toBeLessThanOrEqual(26);
  expect((await page.locator(".lh-contents").boundingBox())!.width).toBeLessThanOrEqual(360);
});

test("the logo has no shine or hover effect", async ({ page }) => {
  await page.goto("/about");
  const logo = page.locator("[data-launch-header] .lh-logo");
  await logo.hover();
  for (const part of [".cf-logo-symbol", ".cf-logo-word"]) {
    const after = await logo.locator(part).evaluate((el) => {
      const s = getComputedStyle(el, "::after");
      return { content: s.content, animation: s.animationName };
    });
    expect(after.content === "none" || after.content === "normal").toBe(true);
    expect(after.animation).toBe("none");
  }
});
