import { expect, test } from "@playwright/test";

const ADMIN = {
  id: "507f1f77bcf86cd799439011",
  email: "operator@example.com",
  first_name: "CodeForge",
  last_name: "Admin",
  created_at: "2026-09-23T00:00:00Z",
  is_admin: true,
  email_verified: true,
  totp_enabled: true,
};

const USER = {
  id: "507f1f77bcf86cd799439012",
  email: "member@example.com",
  first_name: "Normal",
  last_name: "User",
  created_at: "2026-09-22T00:00:00Z",
  is_admin: false,
  project_count: 2,
  run_count: 4,
  succeeded_runs: 3,
  last_activity_at: "2026-09-23T01:00:00Z",
  email_verified: true,
  is_suspended: false,
  suspended_at: null,
  suspended_reason: null,
  project_limit: null,
  monthly_run_limit: null,
};

test("admin deletion requires password, typed confirmation, and an audit reason", async ({ page }) => {
  let submitted: Record<string, string> | null = null;

  await page.addInitScript(() => localStorage.setItem("codeforge_token", "ui-test-token"));
  await page.route("http://localhost:8000/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN) }),
  );
  await page.route(`http://localhost:8000/admin/users/${USER.id}/delete`, async (route) => {
    submitted = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ projects_deleted: 2, runs_deleted: 4, artifacts_deleted: 8 }),
    });
  });
  await page.route(`http://localhost:8000/admin/users/${USER.id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: USER, projects: [], recent_runs: [] }),
    }),
  );

  await page.goto(`/admin/users/${USER.id}`);
  await page.getByRole("button", { name: "Delete user" }).click();
  await expect(page.getByText(/permanently removes member@example.com/i)).toBeVisible();

  const confirmButton = page.getByRole("button", { name: "Permanently delete user" });
  await expect(confirmButton).toBeDisabled();
  await page.getByPlaceholder("Reason for this action").fill("Confirmed account removal request.");
  await page.getByLabel("Administrator password").fill("AdminPassword123");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page).toHaveURL(/\/admin\/users$/);
  expect(submitted).toEqual({
    current_password: "AdminPassword123",
    confirmation: "DELETE",
    reason: "Confirmed account removal request.",
  });
});
