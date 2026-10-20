import { expect, test, type Page } from "@playwright/test";

const id = "amicro-run";
async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user", email: "user@example.com", first_name: "Regular", last_name: "User", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route(`**/api/backend/runs/${id}`, route => route.fulfill({ json: { id, project_id: "project", status: "succeeded", prompt: "Build books", created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z", state: {} } }));
  await page.route(`**/api/backend/runs/${id}/preview`, route => route.fulfill({ json: { operations: [] } }));
}

test("download morph follows real pending/failure/success and never hover", async ({ page }) => {
  await session(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route(`**/api/backend/runs/${id}/artifacts`, route => route.fulfill({ json: { artifacts: [{ file_id: "archive", filename: "project.zip", kind: "file_tree", iteration: 1 }] } }));
  await page.route(`**/api/backend/runs/${id}/artifacts/archive`, async route => {
    await gate;
    return fail ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ contentType: "application/zip", body: "test archive" });
  });
  await page.goto(`/runs/${id}/use`);
  const button = page.getByRole("button", { name: "Download project", exact: true });
  await button.hover();
  await expect(button.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "idle");
  await button.click();
  const pending = page.getByRole("button", { name: "Downloading…", exact: true });
  await expect(pending).toBeDisabled();
  await expect(pending.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "pending");
  release();
  await expect(button).toBeEnabled();
  await expect(button.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "idle");
  fail = false;
  const download = page.waitForEvent("download");
  await button.click();
  await download;
  await expect(page.getByRole("button", { name: "Download started", exact: true }).locator("[data-action-icon]")).toHaveAttribute("data-action-state", "success");
});

test("publish cloud reflects pending and failure without claiming success", async ({ page }) => {
  await session(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/backend/runs/${id}/deployment`, async route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 404, json: { error: { code: "not_found" } } });
    await gate;
    return route.fulfill({ status: 503, json: { error: { code: "service_unavailable" } } });
  });
  await page.goto(`/runs/${id}/publish`);
  const publish = page.getByRole("button", { name: "Publish API", exact: true });
  await publish.hover();
  await expect(publish.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "idle");
  await publish.click();
  await expect(publish.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "pending");
  await expect(publish).toBeDisabled();
  release();
  await expect(publish).toBeEnabled();
  await expect(publish.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "idle");
});

test("reload icon follows connection check and respects reduced motion", async ({ page }) => {
  await session(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(`**/api/backend/runs/${id}/deployment`, route => route.fulfill({ json: { id: "deployment", run_id: id, status: "active", url: "https://example.com/api", key_prefix: "cf_key", created_at: "2026-10-20T00:00:00Z" } }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/backend/runs/${id}/deployment/check`, async route => {
    await gate;
    return route.fulfill({ json: { ready: true, detail: "Ready", checked_at: "2026-10-20T00:00:00Z", duration_ms: 3, requests_this_minute: 0, request_limit: 60 } });
  });
  await page.goto(`/runs/${id}/publish`);
  const check = page.getByRole("button", { name: "Check connection", exact: true });
  await check.click();
  await expect(check.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "pending");
  await expect(check.locator("svg")).toHaveCSS("animation-name", "none");
  release();
  await expect(check.locator("[data-action-icon]")).toHaveAttribute("data-action-state", "success");
});
