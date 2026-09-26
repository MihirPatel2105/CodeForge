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

const EMPTY_PAGE = {
  items: [],
  pagination: { page: 1, page_size: 25, total: 0, pages: 1 },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("codeforge_token", "admin-token"));
  await page.route("http://localhost:8000/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(ADMIN),
  }));
});

test("all admin text searches update results while typing", async ({ page }) => {
  const userQueries: string[] = [];
  const runQueries: string[] = [];
  const auditQueries: string[] = [];

  await page.route("http://localhost:8000/admin/users**", (route) => {
    userQueries.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPTY_PAGE) });
  });
  await page.route("http://localhost:8000/admin/runs**", (route) => {
    runQueries.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPTY_PAGE) });
  });
  await page.route("http://localhost:8000/admin/audit-log**", (route) => {
    auditQueries.push(new URL(route.request().url()).searchParams.get("action") ?? "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPTY_PAGE) });
  });

  await page.goto("/admin/users");
  const usersSearch = page.getByPlaceholder("Name or email");
  await usersSearch.fill("T");
  await expect.poll(() => userQueries.at(-1)).toBe("T");
  await usersSearch.fill("Ta");
  await expect.poll(() => userQueries.at(-1)).toBe("Ta");

  await page.goto("/admin/runs");
  await page.getByPlaceholder("Search run prompt").fill("book");
  await expect.poll(() => runQueries.at(-1)).toBe("book");

  await page.goto("/admin/audit");
  await page.getByRole("textbox", { name: "Action" }).fill("user.");
  await expect.poll(() => auditQueries.at(-1)).toBe("user.");
});

test("audit records stay readable and filters can be cleared", async ({ page }) => {
  const actions: string[] = [];
  await page.route("http://localhost:8000/admin/audit-log**", (route) => {
    const action = new URL(route.request().url()).searchParams.get("action") ?? "";
    actions.push(action);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: action ? [] : [{
          id: "audit-1",
          admin_email: "operator@example.com",
          action: "user.suspended",
          target_type: "user",
          target_id: "target-123",
          reason: "Repeated policy violation",
          details: {},
          created_at: "2026-09-23T00:00:00Z",
        }],
        pagination: { page: 1, page_size: 25, total: action ? 0 : 1, pages: 1 },
      }),
    });
  });

  await page.goto("/admin/audit");
  await expect(page.getByRole("table")).toContainText("user.suspended");
  await expect(page.getByRole("table")).toContainText("Repeated policy violation");
  await page.getByRole("textbox", { name: "Action" }).fill("missing.action");
  await expect.poll(() => actions.at(-1)).toBe("missing.action");
  await expect(page.getByText("No actions found")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect.poll(() => actions.at(-1)).toBe("");
  await expect(page.getByRole("table")).toContainText("user.suspended");
});
