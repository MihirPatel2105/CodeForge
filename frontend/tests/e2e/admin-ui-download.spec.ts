import { expect, test } from "@playwright/test";

test("API-only stays the default and Admin UI opt-in reaches the download request", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "ui-user", email: "user@example.com", first_name: "Test", created_at: "2026-10-23T00:00:00Z" } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/runs/ui-run/artifacts", route => route.fulfill({ json: { artifacts: [{ kind: "file_tree", file_id: "source", filename: "library.zip", iteration: 0 }] } }));
  const urls: string[] = [];
  await page.route("**/api/backend/runs/ui-run/artifacts/source*", route => {
    urls.push(route.request().url());
    return route.fulfill({ body: "archive", contentType: "application/octet-stream" });
  });
  await page.goto("/runs/ui-run/use");
  await expect(page.getByRole("checkbox", { name: /Include Admin UI/ })).not.toBeChecked();
  const plain = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download API only", exact: true }).click();
  expect((await plain).suggestedFilename()).toBe("library.zip");
  expect(new URL(urls[0]).searchParams.has("include_admin_ui")).toBe(false);
  await page.getByRole("checkbox", { name: /Include Admin UI/ }).check();
  const withUi = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download API + Admin UI", exact: true }).click();
  expect((await withUi).suggestedFilename()).toBe("library-with-admin-ui.zip");
  expect(new URL(urls[1]).searchParams.get("include_admin_ui")).toBe("true");
});
