import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const runId = "enhanced-run";
async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", first_name: "Alex", email: "user@example.com", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
}
async function published(page: Page, url = "https://api.example.com/books?api_key=private-token#private-fragment", status = "active") {
  await session(page);
  await page.route(`**/api/backend/runs/${runId}/deployment`, route => route.fulfill({ json: { id: "deployment-1", run_id: runId, url, key_prefix: "cf_live_prefix", status, created_at: "2026-10-13T10:00:00Z" } }));
  await page.route(`**/api/backend/runs/${runId}/preview`, route => route.fulfill({ json: { operations: [] } }));
  await page.route(`**/api/backend/runs/${runId}`, route => route.fulfill({ json: { id: runId, status: "succeeded", state: {}, metrics: null } }));
}

test("mobile navigation opens, closes, restores focus and follows a link", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open navigation menu" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Explore CodeForge" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("demo carousel supports keyboard, arrows and native horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const region = page.getByRole("region", { name: "Example APIs" });
  const slides = page.getByLabel("Swipe through API examples");
  await slides.scrollIntoViewIfNeeded();
  await slides.focus();
  await page.keyboard.press("ArrowRight");
  await expect(region.getByText("Example 2 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Next API example" }).click();
  await expect(region.getByText("Example 3 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next API example" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous API example" }).click();
  await expect(region.getByText("Example 2 of 3")).toBeVisible();
  await slides.hover();
  await page.mouse.wheel(-1000, 0);
  await expect(region.getByText("Example 1 of 3")).toBeVisible();
  await page.screenshot({ path: "/tmp/codeforge-carousel-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await region.getByRole("link", { name: "Explore Library API" }).click();
  await expect(page).toHaveURL(/\/demo\/library$/);
});

test("expanding playback control pauses and resumes the real walkthrough", async ({ page }) => {
  await page.goto("/");
  const pause = page.getByRole("button", { name: "Pause walkthrough" });
  await pause.scrollIntoViewIfNeeded();
  await pause.click();
  const play = page.getByRole("button", { name: "Play walkthrough" });
  await expect(play).toBeVisible();
  await expect(page.locator(".cf-playback-control")).toHaveCSS("width", "100px");
  await play.click();
  await expect(pause).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Replay walkthrough" })).toBeDisabled();
  await expect(page.locator(".cf-flip-word").first()).toHaveCSS("transform", "none");
});

test("share sheet copies and shares only the address and downloads a local QR", async ({ page }) => {
  await published(page);
  await page.addInitScript(() => {
    const state = window as unknown as { copied: string; shared: unknown };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { state.copied = value; } } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (value: unknown) => { state.shared = value; } });
  });
  await page.goto(`/runs/${runId}/publish`);
  await page.getByRole("button", { name: "Share API address", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share API address" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Shared API address")).toHaveText("https://api.example.com/books");
  await expect(dialog).not.toContainText("private-token");
  await expect(dialog).not.toContainText("private-fragment");
  await dialog.getByRole("button", { name: "Copy API address", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "API address copied" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe("https://api.example.com/books");
  await dialog.getByRole("button", { name: "Share…", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { shared: unknown }).shared)).toEqual({ title: "CodeForge API", url: "https://api.example.com/books" });
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download QR" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("codeforge-api-qr.svg");
  expect(await readFile((await download.path())!, "utf8")).toContain("<svg");
  await page.screenshot({ path: "/tmp/codeforge-share-sheet.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("sharing handles unavailable clipboard and omits actions for invalid or unpublished URLs", async ({ page }) => {
  await published(page);
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }));
  await page.goto(`/runs/${runId}/publish`);
  await page.getByRole("button", { name: "Share API address", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share API address" });
  await dialog.getByRole("button", { name: "Copy API address", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Couldn't copy");
  await published(page, "javascript:alert(1)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Connection details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share API address", exact: true })).toHaveCount(0);
  await published(page, "https://api.example.com/books", "starting");
  await page.reload();
  await expect(page.getByRole("button", { name: "Share API address", exact: true })).toHaveCount(0);
});

test("agent glow follows working state, reduced motion stops it and code stays unmasked", async ({ page }) => {
  await session(page);
  const at = "2026-10-13T10:00:00Z";
  const content = Array.from({ length: 60 }, (_, i) => `value_${i} = ${i}`).join("\n");
  await page.route(`**/api/backend/runs/${runId}`, route => route.fulfill({ json: { id: runId, project_id: "project-1", prompt: "Build a library", status: "running", state: { files: [{ path: "main.py", content }] }, metrics: null, created_at: at, updated_at: at } }));
  await page.route(`**/api/backend/runs/${runId}/files`, route => route.fulfill({ json: { run_id: runId, files: [{ path: "main.py", content }] } }));
  let completed = false;
  await page.route(`**/api/backend/runs/${runId}/stream`, route => {
    const events = [{ event: "run.started", run_id: runId, prompt: "Build a library", at }, { event: "agent.started", agent: "coder", iteration: 0, at }, { event: "file.written", path: "main.py", bytes: content.length, at }, ...(completed ? [{ event: "agent.completed", agent: "coder", output_summary: {}, duration_ms: 1, at }] : [])];
    return route.fulfill({ contentType: "text/event-stream", body: events.map((event, i) => `id: ${i + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") });
  });
  await page.goto(`/runs/${runId}`);
  const coder = page.locator('[data-stage="coder"]');
  await expect(coder).toHaveClass(/cf-agent-glow/);
  expect(await coder.evaluate(el => getComputedStyle(el, "::after").animationName)).toBe("cf-agent-border");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await coder.evaluate(el => getComputedStyle(el, "::after").animationName)).toBe("none");
  const codeViewport = page.locator('[data-slot="scroll-area-viewport"]').filter({ hasText: "value_59" });
  await expect(codeViewport).toHaveCSS("mask-image", "none");
  completed = true;
  await page.reload();
  await expect(coder).toHaveAttribute("data-state", "done");
  await expect(coder).not.toHaveClass(/cf-agent-glow/);
});
