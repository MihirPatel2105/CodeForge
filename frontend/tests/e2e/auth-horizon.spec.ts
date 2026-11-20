import { expect, test } from "@playwright/test";

// Auth layout: a black band carrying the landing's sunlit horizon (no agent markers), and the
// real form straight on the cream canvas.
const PAGES = [
  { path: "/login", headline: "Your next idea starts here.", field: "Email" },
  { path: "/signup", headline: "Start your first build.", field: "First name" },
  { path: "/forgot-password", headline: "Back to your builds in a minute.", field: "Email" },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ status: 401, json: {} }));
});

for (const { path, headline, field } of PAGES) {
  test(`${path} pairs the horizon band with the form on cream`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const panel = page.locator(".ah-panel");
    await expect(panel.locator(".ah-headline").filter({ hasText: headline })).toHaveCSS("color", "rgb(245, 243, 238)");
    await expect(panel.locator("canvas.lh-world")).toHaveAttribute("data-state", "still");
    await expect(panel.locator(".lh-node-label, .lh-beacon")).toHaveCount(0);
    await expect(page.getByLabel(field, { exact: true })).toBeVisible();
    const form = page.locator(".pa-form");
    await expect(form).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(form).toHaveCSS("box-shadow", "none");
    await expect(page.locator(".ah-auth")).toHaveCSS("background-color", "rgb(250, 249, 245)");
    const [panelBox, formBox] = await Promise.all([panel.boundingBox(), form.boundingBox()]);
    expect(panelBox!.x).toBe(0);
    expect(panelBox!.height).toBeGreaterThanOrEqual(899);
    expect(formBox!.x).toBeGreaterThan(panelBox!.x + panelBox!.width - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  });
}

test("on a phone the horizon is a short strip and the form comes first", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const box = await page.locator(".ah-panel").boundingBox();
  expect(box!.height).toBeLessThanOrEqual(240);
  await expect(page.getByLabel("Email", { exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("the horizon panel is a complementary aside and the form title is the page's first heading", async ({ page }) => {
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ status: 401, json: {} }));
  for (const route of ["/login", "/signup", "/forgot-password"]) {
    await page.goto(route);
    await expect(page.getByRole("complementary", { name: "About CodeForge" }), route).toBeVisible();
    const firstHeading = await page.locator("h1, h2, h3").first().evaluate((el) => el.tagName);
    expect(firstHeading, route).toBe("H1");
  }
});

// The form clips its contents for the height animation; serif capitals overhang their box, so the
// title needs room inside that clip or its first letter is shaved (seen on "Sign in" and "Create account").
for (const path of ["/login", "/signup", "/login/passkey", "/forgot-password", "/reset-password/example-token", "/sign-in-alert/example-alert-token", "/recover-2fa", "/recover-2fa/request/example-invite", "/recover-2fa/example-recovery-token-long-enough"]) {
  test(`${path} keeps room around its title inside the clipped form`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const form = page.locator(".pa-form");
    const [box, title] = await Promise.all([form.boundingBox(), form.locator("h1").boundingBox()]);
    expect(title!.x - box!.x).toBeGreaterThanOrEqual(6);
    expect(title!.y - box!.y).toBeGreaterThanOrEqual(6);
  });
}

test("the passkey screen uses the shared form styling, not the old card's accents", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login/passkey");
  const form = page.locator(".pa-form");
  await expect(form.getByText("Your workspace", { exact: true })).toHaveCount(0);
  const action = form.getByRole("button", { name: "Continue with passkey" });
  await expect(action).toHaveCSS("border-radius", "12px");
  await expect(action).toHaveCSS("height", "44px");
  await expect(form.locator(".pa-passkey-icon")).toHaveCSS("border-radius", "8px");
  await expect(form.getByRole("link", { name: "Sign in with password" })).toHaveCSS("color", "rgb(20, 20, 19)");
});

test("forgot password uses the shared form styling, not the old card's accents", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/forgot-password");
  const form = page.locator(".pa-form");
  await expect(form.getByText("Account recovery", { exact: true })).toHaveCount(0);
  const action = form.getByRole("button", { name: "Send reset link" });
  await expect(action).toHaveCSS("border-radius", "12px");
  await expect(action).toHaveCSS("height", "44px");
  await expect(form.getByLabel("Email", { exact: true })).toHaveCSS("border-radius", "8px");
  await expect(form.locator("details")).toHaveCSS("border-radius", "8px");
  await expect(form.getByRole("link", { name: "Sign in", exact: true })).toHaveCSS("color", "rgb(20, 20, 19)");
});

test("reset password uses the shared form styling, not the old card's accents", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/reset-password/example-token");
  const form = page.locator(".pa-form");
  await expect(form.getByText("Account recovery", { exact: true })).toHaveCount(0);
  const action = form.getByRole("button", { name: "Save new password" });
  await expect(action).toHaveCSS("border-radius", "12px");
  await expect(action).toHaveCSS("height", "44px");
  for (const label of ["New password", "Confirm new password"]) {
    await expect(form.getByLabel(label, { exact: true })).toHaveCSS("border-radius", "8px");
  }
  await expect(form.getByRole("link", { name: "Sign in", exact: true })).toHaveCSS("color", "rgb(20, 20, 19)");
});

// Every remaining auth screen shares the form styling: 44px actions with 12px corners (the site's
// primary button), no pills, no dot eyebrows. Each case names the screen's main action.
const CONTROL = async (control: import("@playwright/test").Locator) => {
  await expect(control).toHaveCSS("border-radius", "12px");
  await expect(control).toHaveCSS("height", "44px");
};

test("the sign-in verify step uses the shared form styling", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("codeforge_password_mfa", JSON.stringify({
    ticket: "style-ticket", email: "member@example.com", methods: ["totp", "passkey"], startedAt: Date.now(),
  })));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login/verify");
  const form = page.locator(".pa-form");
  await expect(form.getByRole("heading", { name: "Verify yourself" })).toBeVisible();
  await expect(form.getByText("One more step", { exact: true })).toHaveCount(0);
  await CONTROL(form.getByRole("button", { name: "Verify and sign in" }));
  await expect(form.getByRole("group", { name: "Verification method" }).getByRole("button").first()).toHaveCSS("border-radius", "8px");
  const title = await form.locator("h1").boundingBox(), box = await form.boundingBox();
  expect(title!.x - box!.x).toBeGreaterThanOrEqual(6);
});

test("the sign-up email code step uses the shared form styling", async ({ page }) => {
  await page.route("**/auth/register", (route) => route.fulfill({ json: {
    verification_required: true, email: "new@example.com", expires_at: new Date(Date.now() + 600_000).toISOString(),
    signup_ticket: "t".repeat(43),
  } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/signup");
  await page.getByLabel("First name").fill("New");
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Strongpass1");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const form = page.locator(".pa-form");
  await expect(form.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(form.getByText("Step 2 of 2", { exact: true })).toHaveCSS("border-radius", "0px");
  await CONTROL(form.getByRole("button", { name: "Verify and continue" }));
  await expect(form.getByLabel("Digit 1")).toHaveCSS("border-radius", "8px");
});

test("sign-in alert review and 2FA recovery screens use the shared form styling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sign-in-alert/example-alert-token");
  let form = page.locator(".pa-form");
  await expect(form.getByText("Account security", { exact: true })).toHaveCount(0);
  await CONTROL(form.getByRole("button", { name: "Yes, it was me" }));
  await CONTROL(form.getByRole("button", { name: "No, sign out all devices" }));

  await page.goto("/recover-2fa");
  form = page.locator(".pa-form");
  await CONTROL(form.getByRole("link", { name: "Open Contact page" }));
  await expect(form.locator("h1")).toHaveCSS("font-weight", "400");

  await page.goto("/recover-2fa/request/example-invite");
  await CONTROL(page.locator(".pa-form").getByRole("button", { name: "Submit recovery review request" }));

  await page.goto("/recover-2fa/example-recovery-token-long-enough");
  await CONTROL(page.locator(".pa-form").getByRole("button", { name: "Verify recovery details" }));
});

// The authenticator code slots match the sign-up email-code boxes: full form width, 56px tall,
// 8px corners, a hairline border, ink digits on white, and an ink border on the active box.
test("authenticator code slots match the email-code boxes", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("codeforge_password_mfa", JSON.stringify({
    ticket: "slot-style", email: "member@example.com", methods: ["totp"], startedAt: Date.now(),
  })));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login/verify");
  const slots = page.locator(".cf-verification-code [data-slot]");
  await expect(slots).toHaveCount(6);
  const first = slots.first();
  await expect(first).toHaveCSS("height", "56px");
  await expect(first).toHaveCSS("border-radius", "8px");
  await expect(first).toHaveCSS("background-color", "rgb(250, 249, 245)");
  expect(await slots.nth(1).evaluate(el => getComputedStyle(el).boxShadow)).toContain("inset");
  // The row spans the form, like the email step's six boxes.
  const [row, form] = await Promise.all([
    page.locator(".cf-verification-code").boundingBox(),
    page.locator(".pa-form-content").boundingBox(),
  ]);
  expect(Math.abs(row!.width - form!.width)).toBeLessThanOrEqual(2);
  const input = page.getByLabel("Authenticator code", { exact: true });
  await input.pressSequentially("4");
  await expect(slots.first().locator("span").last()).toHaveCSS("color", "rgb(20, 20, 19)");
  expect(await slots.nth(1).evaluate(el => getComputedStyle(el).boxShadow)).toMatch(/rgb\(20, 20, 19\)/);
  // A typed box keeps its border: nothing paints over it, unlike the old ink flood.
  await expect(slots.first().locator("span").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(await slots.first().evaluate(el => getComputedStyle(el).boxShadow)).toContain("inset");
});

test("after a rejected code the active slot still shows a focus ring, in the error colour", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("codeforge_password_mfa", JSON.stringify({
    ticket: "slot-error", email: "member@example.com", methods: ["totp"], startedAt: Date.now(),
  })));
  await page.route("**/auth/login/complete", route => route.fulfill({ status: 401, json: { error: { code: "invalid_totp", message: "That code was not accepted." } } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login/verify");
  const input = page.getByLabel("Authenticator code", { exact: true });
  await input.pressSequentially("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.focus();
  const danger = await page.evaluate(() => {
    const probe = document.createElement("i"); probe.style.color = "var(--danger)"; document.body.append(probe);
    const value = getComputedStyle(probe).color; probe.remove(); return value;
  });
  const active = page.locator(".cf-verification-code [data-slot][data-active]");
  await expect(active).toHaveCount(1);
  const shadow = await active.evaluate(el => getComputedStyle(el).boxShadow);
  expect(shadow).toContain(danger);
  // Two layers: the inset border and the outer ring.
  expect(shadow.split("inset").length).toBe(2);
  expect(shadow).toMatch(/0px 0px 0px 4px/);
});
