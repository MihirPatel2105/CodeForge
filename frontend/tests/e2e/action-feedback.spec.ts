import { expect, test, type Page } from "@playwright/test";

async function openTester(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "feedback-user", first_name: "Preview", is_admin: false } }));
  await page.route("**/api/backend/runs/feedback-run/preview", route => route.fulfill({ json: {
    expires_after_seconds: 900, session_started: false,
    operations: [{ method: "GET", path: "/items", summary: "List items", has_body: false }],
  } }));
  await page.goto("/runs/feedback-run/try");
  await expect(page.getByRole("button", { name: "Send request", exact: true })).toBeVisible();
}

test("send feedback stays pending until the response arrives and allows another request after success", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await openTester(page);
  await page.route("**/api/backend/runs/feedback-run/preview/request", async route => {
    requests++;
    await gate;
    await route.fulfill({ json: { status: 200, content_type: "application/json", body: "[]", duration_ms: 10, truncated: false } });
  });
  const send = page.getByRole("button", { name: "Send request", exact: true });
  await send.click();
  await expect(send).toBeDisabled();
  await expect(send).toHaveAttribute("aria-busy", "true");
  await expect(send.getByRole("status")).not.toHaveText("Sent");
  release();
  await expect(send.getByRole("status")).toHaveText("Sent");
  await expect(send).toBeEnabled();
  await send.click();
  await expect.poll(() => requests).toBe(2);
});

test("an HTTP failure is shown as a failure rather than a successful send", async ({ page }) => {
  await openTester(page);
  await page.route("**/api/backend/runs/feedback-run/preview/request", route => route.fulfill({ json: {
    status: 404, content_type: "application/json", body: '{"error":"Missing item"}', duration_ms: 10, truncated: false,
  } }));
  const send = page.getByRole("button", { name: "Send request", exact: true });
  await send.click();
  await expect(page.getByText("HTTP 404 · 10 ms", { exact: true })).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toContainText("Request returned HTTP 404.");
  await expect(send.getByRole("status")).not.toHaveText("Sent");
  await expect(send).toBeEnabled();
});

test("saving requests reports storage failure and keeps parameter values after removing a row", async ({ page }) => {
  await openTester(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("private storage failure"); }; });
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter name 2", { exact: true }).fill("limit");
  await page.getByLabel("Parameter value 2", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Remove parameter 1", exact: true }).click();
  await expect(page.getByLabel("Parameter name 1", { exact: true })).toHaveValue("limit");
  await expect(page.getByLabel("Parameter value 1", { exact: true })).toHaveValue("25");
  await page.getByRole("button", { name: "Save request", exact: true }).click();
  await expect(page.locator("[data-sonner-toast]")).toContainText("Could not save this request on this device.");
  await expect(page.locator("[data-sonner-toast]")).not.toContainText("private storage failure");
});

test("switching to reduced motion during removal leaves no stale saved request", async ({ page }) => {
  await openTester(page);
  await page.getByRole("button", { name: "Save request", exact: true }).click();
  const saved = page.locator("section").filter({ has: page.getByRole("heading", { name: "Saved requests", exact: true }) }).last();
  await expect(saved.getByRole("button", { name: "GET /items", exact: true })).toBeVisible();
  await expect(saved.getByText("No saved requests", { exact: true })).toHaveCount(0);
  await saved.getByRole("button", { name: "Remove", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(saved.getByRole("button", { name: "GET /items", exact: true })).toHaveCount(0);
  await expect(saved.getByText("No saved requests", { exact: true })).toBeVisible();
});

test("parameter checkbox supports Space and is disabled while its request is pending", async ({ page }) => {
  await openTester(page);
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter name 1", { exact: true }).fill("limit");
  await page.getByLabel("Parameter value 1", { exact: true }).fill("25");
  const checkbox = page.getByRole("checkbox", { name: "Include parameter 1" });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).not.toBeChecked();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let path: string | undefined;
  await page.route("**/api/backend/runs/feedback-run/preview/request", async route => {
    path = route.request().postDataJSON().path;
    await gate;
    await route.fulfill({ json: { status: 200, content_type: "application/json", body: "[]", duration_ms: 10, truncated: false } });
  });
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(checkbox).toBeDisabled();
  release();
  await expect(checkbox).toBeEnabled();
  expect(path).toBe("/items");
});
