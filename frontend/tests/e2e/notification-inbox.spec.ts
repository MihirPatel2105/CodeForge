import { expect, test, type Page } from "@playwright/test";

const user = { id: "inbox-user", email: "inbox@example.com", first_name: "Inbox", last_name: "User", is_admin: false, created_at: "2026-10-01T00:00:00Z" };
const completed = { id: "inbox-completed", project_id: "inbox-project", prompt: "Build a library API", status: "succeeded", iterations: 0, created_at: "2026-10-18T10:00:00Z", updated_at: "2026-10-18T10:00:00Z" };
const approval = { ...completed, id: "inbox-approval", prompt: "Review inventory proposal", status: "awaiting_approval" };
async function setup(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: user }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [approval, completed] }));
  await page.goto("/");
  await page.getByRole("button", { name: /Run updates/ }).click();
}
test("Arc inbox filters, expands, persists read state and protects approvals", async ({ page }) => {
  await setup(page);
  const panel = page.getByRole("dialog", { name: "Run updates" });
  await expect(panel.getByText(completed.prompt, { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Needs approval", exact: true }).click();
  await expect(panel.getByText(approval.prompt, { exact: true })).toBeVisible();
  await expect(panel.getByText(completed.prompt, { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "All", exact: true }).click();
  await panel.getByRole("button", { name: /succeeded/ }).click();
  await expect(panel.getByRole("link", { name: "Open run" })).toHaveAttribute("href", `/runs/${completed.id}`);
  await panel.getByRole("button", { name: "Mark read", exact: true }).click();
  await panel.getByRole("button", { name: "Unread", exact: true }).click();
  await expect(panel.getByText(completed.prompt, { exact: true })).toHaveCount(0);
  await expect(panel.getByText(approval.prompt, { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Clear read updates" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Run updates/ })).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: /Run updates/ }).click();
  await expect(panel.getByText(approval.prompt, { exact: true })).toBeVisible();
  await expect(panel.getByText(completed.prompt, { exact: true })).toHaveCount(0);
});
test("Arc inbox stays inside a narrow viewport with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await setup(page);
  const panel = page.getByRole("dialog", { name: "Run updates" });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  await page.screenshot({ path: "/tmp/codeforge-arc-inbox-mobile.png" });
});
test("open inbox receives fresh polling updates without losing the selected view", async ({ page }) => {
  await page.clock.install();
  await setup(page);
  const panel = page.getByRole("dialog", { name: "Run updates" });
  await panel.getByRole("button", { name: "Finished", exact: true }).click();
  await panel.getByRole("button", { name: /succeeded/ }).click();
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [approval, completed, { ...completed, id: "new-run", prompt: "New completed run" }] }));
  await page.clock.fastForward(15_100);
  await expect(panel.getByText("New completed run", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Finished", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("link", { name: "Open run" })).toBeVisible();
  await page.screenshot({ path: "/tmp/codeforge-arc-inbox-desktop.png" });
});

for (const path of ["/", "/faq"]) {
  test(`notification panel stays anchored while scrolling ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page);
    if (path !== "/") {
      await page.goto(path);
      await page.getByRole("button", { name: /Run updates/ }).click();
    }
    const panel = page.getByRole("dialog", { name: "Run updates" });
    await expect(panel).toBeVisible();
    await expect(panel.locator("..")).toHaveCSS("position", "fixed");
    await panel.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
    const before = await panel.boundingBox();
    await page.mouse.move(30, 800);
    await page.mouse.wheel(0, 650);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
    await expect.poll(async () => Math.abs((await panel.boundingBox())!.y - before!.y)).toBeLessThanOrEqual(2);
    await page.getByRole("button", { name: "Close run updates" }).click();
    await expect(panel).toHaveCount(0);
  });
}
