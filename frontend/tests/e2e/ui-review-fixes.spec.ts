import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/**", route => route.fulfill({ json: [] }));
  await page.route("**/auth/me", route => route.fulfill({ json: {
    id: "ui-user", email: "user@example.com", first_name: "Regular", last_name: "User",
    created_at: "2026-10-01T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false,
  } }));
});

for (const empty of [false, true]) {
  test(`device failure retries into a ${empty ? "genuine empty" : "loaded"} state`, async ({ page }) => {
    let reads = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/auth/devices", async route => {
      reads++;
      if (reads === 1) return route.fulfill({ status: 503, json: { error: { code: "service_unavailable" } } });
      await gate;
      return route.fulfill({ json: empty ? [] : [{
        id: "device-one", label: "Chrome on macOS", current: false, active_sessions: 1,
        first_seen_at: "2026-10-01T00:00:00Z", last_seen_at: "2026-10-01T00:00:00Z", ip_address: null,
      }] });
    });
    await page.goto("/profile/settings");
    const retry = page.getByRole("button", { name: "Retry devices", exact: true });
    await expect(retry).toBeVisible();
    await expect(page.getByText("No tracked browser sessions yet.", { exact: false })).toHaveCount(0);
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Loading devices…", { exact: true })).toBeVisible();
    release();
    if (empty) await expect(page.getByText("No tracked browser sessions yet.", { exact: false })).toBeVisible();
    else await expect(page.getByText("Chrome on macOS", { exact: true })).toBeVisible();
    await expect(retry).toHaveCount(0);
    expect(reads).toBe(2);
  });
}

test("archive empty states have useful actions and expose the selected filter", async ({ page }) => {
  await page.route("**/projects/overview*", route => {
    const params = new URL(route.request().url()).searchParams;
    const archived = params.get("archived") === "true";
    const items = archived ? [] : [{
      id: "books", name: "Book Collection", description: "Library catalogue API", created_at: "2026-10-01T00:00:00Z",
      recent_runs: [], stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: null, last: null },
    }];
    return route.fulfill({ json: { items, next_cursor: null, total_projects: items.length,
      matching_projects: items.length, total_runs: 0, total_succeeded: 0 } });
  });
  await page.goto("/projects");
  const filters = page.getByRole("group", { name: "Project view" });
  const active = filters.getByRole("button", { name: "Active projects", exact: true });
  const archived = filters.getByRole("button", { name: "Archived projects", exact: true });
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await archived.focus();
  await page.keyboard.press("Space");
  await expect(archived).toHaveAttribute("aria-pressed", "true");
  await expect(active).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("heading", { name: "No archived projects yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear search", exact: true })).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await search.fill("missing");
  await expect(page.getByRole("heading", { name: "No archived projects found" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("heading", { name: "No archived projects yet" })).toBeVisible();
  await page.getByRole("button", { name: "Back to active projects", exact: true }).click();
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('a[href="/projects/books"]')).toBeVisible();
});

test("password mismatch is linked to its field, receives focus, and clears when corrected", async ({ page }) => {
  let submissions = 0;
  await page.route("**/auth/reset-password", route => { submissions++; return route.fulfill({ status: 401, json: {} }); });
  await page.goto("/reset-password/ui-test-link");
  const password = page.getByLabel("New password", { exact: true });
  const confirmation = page.getByLabel("Confirm new password", { exact: true });
  await password.fill("ValidPassword123");
  await confirmation.fill("DifferentPassword123");
  await page.getByRole("button", { name: "Save new password", exact: true }).click();
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await expect(confirmation).toHaveAttribute("aria-describedby", "confirm-password-error");
  await expect(page.locator("#confirm-password-error")).toHaveText("The two passwords don't match.");
  expect(submissions).toBe(0);
  await confirmation.fill("ValidPassword123");
  await expect(confirmation).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#confirm-password-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Save new password", exact: true }).click();
  await expect.poll(() => submissions).toBe(1);
});
