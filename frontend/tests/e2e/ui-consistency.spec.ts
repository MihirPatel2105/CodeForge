import { expect, test, type Locator, type Page } from "@playwright/test";

async function session(page: Page) {
  await page.addInitScript(() => {
    document.cookie = "codeforge_session_present=1; Path=/";
    localStorage.setItem("codeforge-theme", "light");
    sessionStorage.setItem("codeforge:desktop-recommendation-dismissed", "1");
  });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
    id: "consistency-user", email: "operator@example.com", first_name: "Operator", is_admin: true, totp_enabled: true,
  } }));
  await page.route("**/api/backend/auth/admin-access", route => route.fulfill({ json: { allowed: true, expires_at: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/auth/passkeys", route => route.fulfill({ json: [] }));
}

async function scale(control: Locator) {
  return control.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
}

test("marketing, authentication, security, and admin actions share geometry and field styling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 401, json: {} }));
  const cases = [
    { path: "/contact", action: () => page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }), height: 52 },
    { path: "/login", action: () => page.getByRole("button", { name: "Sign in", exact: true }), height: 52 },
    { path: "/profile/settings/password", action: () => page.getByRole("button", { name: "Change password", exact: true }), height: 44 },
    { path: "/profile/settings/passkeys", action: () => page.getByRole("button", { name: "Add passkey", exact: true }), height: 44 },
    { path: "/admin/runs", action: () => page.getByRole("button", { name: "Apply", exact: true }), height: 40 },
  ];
  for (const entry of cases) {
    if (entry.path === "/profile/settings/password") await session(page);
    await page.goto(entry.path);
    await expect(entry.action()).toBeVisible();
    await expect(entry.action()).toHaveCSS("border-radius", "999px");
    await expect(entry.action()).toHaveCSS("height", `${entry.height}px`);
    const fields = page.locator("main .cf-field:visible");
    for (const field of await fields.all()) await expect(field).toHaveCSS("border-radius", "12px");
  }
  await expect(page.getByRole("button", { name: "Running", exact: true })).toHaveCSS("border-radius", "8px");
  await expect(page.getByRole("button", { name: "Clear", exact: true })).toHaveCSS("border-radius", "8px");
});

test("navigation actions and submit buttons have matching hover and press feedback", async ({ page }) => {
  await page.route("**/api/backend/**", route => route.fulfill({ status: 401, json: {} }));
  const cases = [
    { path: "/contact", control: () => page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }) },
    { path: "/login", control: () => page.getByRole("button", { name: "Sign in", exact: true }) },
  ];
  for (const entry of cases) {
    await page.goto(entry.path);
    const control = entry.control();
    await control.hover();
    await expect.poll(() => scale(control)).toBeCloseTo(1.01, 3);
    await page.mouse.down();
    await expect.poll(() => scale(control)).toBeCloseTo(0.98, 3);
    await page.mouse.move(2, 2);
    await page.mouse.up();
    await expect.poll(() => scale(control)).toBeCloseTo(1, 3);
  }
});

test("changing motion preference resets a hovered action and suppresses press animation", async ({ page }) => {
  await page.goto("/contact");
  const control = page.getByRole("main").getByRole("link", { name: "Sign in", exact: true });
  await control.hover();
  await expect.poll(() => scale(control)).toBeCloseTo(1.01, 3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => scale(control)).toBeCloseTo(1, 3);
  await expect(control).toHaveCSS("transition-duration", "0s");
  await page.mouse.down();
  await expect.poll(() => scale(control)).toBeCloseTo(1, 3);
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await expect(control).toHaveAttribute("href", "/login");
});

test("disabled security actions stay still and keyboard focus remains visible in both themes", async ({ page }) => {
  await session(page);
  await page.goto("/profile/settings/password");
  const disabled = page.getByRole("button", { name: "Change password", exact: true });
  await expect(disabled).toBeDisabled();
  await disabled.hover({ force: true });
  await expect.poll(() => scale(disabled)).toBeCloseTo(1, 3);
  const field = page.getByLabel("Current password", { exact: true });
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
    await field.focus();
    await expect(field).toBeFocused();
    await expect.poll(() => field.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
    const colors = await field.evaluate(element => ({ field: getComputedStyle(element).color, surface: getComputedStyle(element).backgroundColor }));
    expect(colors.field).not.toBe(colors.surface);
  }
});

test("city and run view use the same compact theme control", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/playground/agent-city?demo=library", "/demo/library"]) {
    await page.goto(path);
    const toggle = page.getByRole("button", { name: "Dark mode for agent dashboard" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveCSS("border-radius", "8px");
    await expect(toggle).toHaveCSS("height", "36px");
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }
});

test("completed run result navigation uses a link without native-button warnings", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await session(page);
  const at = "2026-10-28T08:00:00Z";
  await page.route("**/api/backend/runs/control-run", route => route.fulfill({ json: {
    id: "control-run", project_id: "control-project", prompt: "Build a library API", status: "succeeded",
    iterations: 0, created_at: at, updated_at: at, state: {}, metrics: null,
  } }));
  await page.route("**/api/backend/runs/control-run/stream", route => route.fulfill({ contentType: "text/event-stream", body: [
    { event: "run.started", run_id: "control-run", prompt: "Build a library API", at },
    { event: "run.completed", status: "succeeded", iterations: 0, duration_ms: 1000, at },
  ].map((event, index) => `id: ${index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") }));
  await page.goto("/runs/control-run");
  const result = page.getByRole("link", { name: "View result", exact: true });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("href", "#run-result");
  await expect(result).not.toHaveAttribute("type", "button");
  await expect(result).not.toHaveAttribute("role", "button");
  await expect(result).toHaveCSS("height", "36px");
  await result.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/runs\/control-run#run-result$/);
  await expect(page.locator("#run-result")).toBeInViewport();
  expect(errors.filter(message => /Base UI:|nativeButton|native <button>/.test(message))).toEqual([]);
});
