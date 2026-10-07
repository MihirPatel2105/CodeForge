import { expect, test } from "@playwright/test";

test("sign-up moves to email verification after a valid registration", async ({ page }) => {
  let registration: Record<string, string> | null = null;
  await page.route("**/auth/register", async (route) => {
    registration = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        verification_required: true,
        email: "new@example.com",
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      }),
    });
  });

  await page.goto("/signup");
  await page.getByLabel("First name").fill("New");
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Strongpass1");
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Verification code" })).toBeVisible();
  expect(registration).toMatchObject({ first_name: "New", email: "new@example.com", password: "Strongpass1" });
});

test("auth routes keep the story and card mounted while swapping forms in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeFocused();
  const story = page.locator(".pa-story");
  const card = page.locator(".pa-form");
  await story.evaluate(element => element.setAttribute("data-persist-check", "story"));
  await card.evaluate(element => element.setAttribute("data-persist-check", "card"));
  const before = await story.boundingBox();
  await expect(story.getByRole("heading", { name: "Your next idea starts here." })).toHaveCSS("opacity", "1");
  await page.getByLabel("Email").fill("person@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Privatepass1");
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("First name")).toBeFocused();
  await expect(story).toHaveAttribute("data-persist-check", "story");
  await expect(card).toHaveAttribute("data-persist-check", "card");
  await expect(story.getByRole("heading", { name: "Your next idea starts here." })).toHaveCSS("animation-name", "none");
  const after = await story.boundingBox();
  expect(after?.x).toBe(before?.x);
  expect(after?.y).toBe(before?.y);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.getByRole("link", { name: "Sign in", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(story).toHaveAttribute("data-persist-check", "story");
  await page.goBack();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("First name")).toBeFocused();
  await expect(story).toHaveAttribute("data-persist-check", "story");
  expect(await page.locator(".pa-auth").count()).toBe(1);
});

test("mobile auth transitions fit narrow screens and reduced motion finishes an active swap", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeFocused();
  const create = page.getByRole("link", { name: "Create an account", exact: true });
  await create.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("First name")).toBeFocused();
  await expect(page.locator(".pa-form")).toHaveCSS("transform", "none");
  await expect(page.locator(".pa-form")).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.locator(".pa-form")).not.toHaveAttribute("inert", "");
  await page.reload();
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.locator(".pa-form")).toHaveCSS("transform", "none");
});

test("auth card stays bounded throughout both transition directions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeFocused();
  for (const destination of ["signup", "login", "login/passkey", "login"]) {
    await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".pa-form")!;
      const samples: number[] = [];
      const state = window as typeof window & { authSamples: number[]; sampleAuth: boolean };
      state.authSamples = samples;
      state.sampleAuth = true;
      const sample = () => {
        const rect = card.getBoundingClientRect();
        samples.push(rect.width / card.offsetWidth, rect.height / card.offsetHeight);
        if (state.sampleAuth) requestAnimationFrame(sample);
      };
      sample();
    });
    const linkName = destination === "signup" ? "Create an account" : destination === "login/passkey" ? "Sign in with a passkey" : page.url().endsWith("/login/passkey") ? "Sign in with password" : "Sign in";
    await page.getByRole("link", { name: linkName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${destination}$`));
    if (destination === "login/passkey") {
      await expect(page.getByRole("button", { name: "Continue with passkey", exact: true })).toBeFocused();
    } else {
      await expect(page.getByLabel(destination === "signup" ? "First name" : "Email")).toBeFocused();
    }
    const samples = await page.evaluate(() => {
      const state = window as typeof window & { authSamples: number[]; sampleAuth: boolean };
      state.sampleAuth = false;
      return state.authSamples;
    });
    expect(samples.length).toBeGreaterThan(10);
    for (const ratio of samples) {
      expect(ratio).toBeLessThan(1.1);
      expect(ratio).toBeGreaterThan(0.9);
    }
  }
});

test("both auth pages fit laptop screens without scrolling", async ({ page }) => {
  for (const viewport of [{ width: 1470, height: 802 }, { width: 1440, height: 720 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["login", "signup"]) {
      await page.goto(`/${route}`);
      await expect(page.getByLabel(route === "signup" ? "First name" : "Email")).toBeFocused();
      const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
      expect(size.width).toBeLessThanOrEqual(viewport.width);
      expect(size.height).toBeLessThanOrEqual(viewport.height);
      const footer = await page.locator(".pa-footer").boundingBox();
      // Browser layout can round the viewport boundary by a fraction of a pixel.
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height + 1);
      await expect(page.getByRole("button", { name: route === "signup" ? "Create account" : "Sign in", exact: true })).toBeInViewport();
    }
  }
});

test("passkey entry turns only the form and preserves the story in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 802 });
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeFocused();
  const story = page.locator(".pa-story");
  const card = page.locator(".pa-form");
  await story.evaluate(element => element.setAttribute("data-persist-check", "passkey-story"));
  await card.evaluate(element => element.setAttribute("data-persist-check", "passkey-card"));
  const before = await story.boundingBox();
  const signInBox = (await card.boundingBox())!;
  const signInHeight = signInBox.height;
  const centerY = signInBox.y + signInBox.height / 2;
  await page.getByRole("link", { name: "Sign in with a passkey", exact: true }).click();
  await expect(page).toHaveURL(/\/login\/passkey$/);
  await expect(page.getByRole("button", { name: "Continue with passkey", exact: true })).toBeFocused();
  await expect(story).toHaveAttribute("data-persist-check", "passkey-story");
  await expect(card).toHaveAttribute("data-persist-check", "passkey-card");
  const passkeyBox = (await card.boundingBox())!;
  expect(passkeyBox.height).toBeLessThan(signInHeight - 80);
  expect(passkeyBox.y + passkeyBox.height / 2).toBeCloseTo(centerY, 0);
  expect(await story.boundingBox()).toEqual(before);
  expect(await page.locator(".pa-auth").count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(802);
  await page.getByRole("link", { name: "Sign in with password", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toBeFocused();
  expect((await card.boundingBox())!.height).toBeCloseTo(signInHeight, 0);
  await expect(story).toHaveAttribute("data-persist-check", "passkey-story");
  expect(await story.boundingBox()).toEqual(before);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Continue with passkey", exact: true })).toBeFocused();
  await expect(story).toHaveAttribute("data-persist-check", "passkey-story");
});
