import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
    id: "palette-user", email: "user@example.com", first_name: "Alex", is_admin: false, email_verified: true,
  } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/projects", route => route.fulfill({ json: [
    { id: "contacts", name: "Contact directory", description: "Manage contacts and favorites", created_at: "2026-10-13" },
    { id: "inventory", name: "Inventory API", description: "Track stock levels", created_at: "2026-10-12" },
  ] }));
  await page.goto("/faq");
});

test("shortcut opens search, supports keyboard selection, and navigates to a project", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Open command palette" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("combobox", { name: "Search commands and projects" });
  await expect(search).toBeFocused();
  await search.fill("contact");
  await expect(page.getByRole("option", { name: /Contact directory/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Inventory API/ })).toHaveCount(0);
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/projects\/contacts$/);
  await expect(page.getByRole("dialog", { name: "Go anywhere" })).toHaveCount(0);
});

test("empty state, Escape, focus restoration and mobile layout", async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await expect(page.getByRole("button", { name: "Open command palette" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const trigger = page.getByRole("button", { name: "Open command palette" });
  await trigger.click();
  const search = page.getByRole("combobox", { name: "Search commands and projects" });
  await search.fill("zzzzzzzz");
  await expect(page.getByText("No matches found")).toBeVisible();
  await search.press("Escape");
  await expect(page.getByRole("dialog", { name: "Go anywhere" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(search).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("failed project loading keeps commands available and offers retry", async ({ page }) => {
  await page.route("**/api/backend/projects", route => route.fulfill({ status: 500, json: { detail: "private exception" } }));
  await page.getByRole("button", { name: "Open command palette" }).click();
  await expect(page.getByText("Projects couldn't load.")).toBeVisible();
  await expect(page.getByRole("option", { name: /Account settings/ })).toBeVisible();
  await expect(page.getByText("private exception")).toHaveCount(0);
  await page.route("**/api/backend/projects", route => route.fulfill({ json: [] }));
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Projects couldn't load.")).toHaveCount(0);
});

test("palette stays within the screen, traps focus and adapts to dark mode", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Open command palette" }).click();
  const dialog = page.getByRole("dialog", { name: "Go anywhere" });
  await expect(page.getByRole("option", { name: /Inventory API/ })).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  await expect(dialog).toHaveCSS("scale", "1");
  const desktopBounds = await dialog.boundingBox();
  expect(desktopBounds!.y).toBeGreaterThanOrEqual(0);
  expect(Math.abs(desktopBounds!.x + desktopBounds!.width / 2 - 720)).toBeLessThan(2);
  await page.screenshot({ path: "/tmp/codeforge-command-palette-desktop.png" });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.getByRole("combobox", { name: "Search commands and projects" }).focus();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "/tmp/codeforge-command-palette-dark.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "/tmp/codeforge-command-palette-mobile.png" });
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812);
  expect(errors).toEqual([]);
});

test("current run commands are available without exposing admin actions", async ({ page }) => {
  await page.goto("/runs/example-run/use");
  await page.getByRole("button", { name: "Open command palette" }).click();
  await expect(page.getByRole("option", { name: /Open API tester/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Open run dashboard/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Admin dashboard/ })).toHaveCount(0);
  const search = page.getByRole("combobox", { name: "Search commands and projects" });
  await search.fill("tster");
  await expect(page.getByRole("option", { name: /Open API tester/ })).toBeVisible();
});
