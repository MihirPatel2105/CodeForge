import { expect, test } from "@playwright/test";

// Three type roles across the whole product, after Anthropic's editorial pattern:
// - serif (Newsreader) for headlines and reading text;
// - sans (Hanken Grotesk) for interface, labels, eyebrows and captions;
// - mono (JetBrains Mono) for code, ids and data.
// All three are open-licence faces, self-hosted through next/font.
const SERIF = "Newsreader";
const SANS = "Hanken Grotesk";
const MONO = "JetBrains Mono";

for (const route of ["/", "/about", "/how-it-works", "/faq", "/login"]) {
  test(`${route} sets headlines in the serif and interface text in the sans`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);

    const heading = page.getByRole("heading", { level: 1 }).first();
    // The family name is always in the stack; what matters is that the face itself loaded.
    const rendered = await heading.evaluate(async (element, [serif, sans]) => {
      await Promise.all([document.fonts.load(`400 48px "${serif}"`), document.fonts.load(`400 16px "${sans}"`)]);
      return {
        heading: getComputedStyle(element).fontFamily.startsWith(`"${serif}"`) || getComputedStyle(element).fontFamily.startsWith(serif),
        body: getComputedStyle(document.body).fontFamily.includes(sans),
        loaded: [serif, sans].every((name) => [...document.fonts].some((face) => face.family.replace(/["']/g, "") === name && face.status === "loaded")),
      };
    }, [SERIF, SANS]);
    expect(rendered).toEqual({ heading: true, body: true, loaded: true });
    await expect(heading).toHaveCSS("font-weight", "400");
  });
}

test("brand faces load from this origin, never from a font CDN", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) external.push(request.url());
  });
  await page.goto("/");
  await page.evaluate((mono) => document.fonts.load(`400 14px "${mono}"`), MONO);
  await page.evaluate(() => document.fonts.ready);

  // `document.fonts.check` is true for families it has never heard of, so look for real faces.
  const loaded = await page.evaluate(([serif, sans, mono]) => {
    const faces = [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replace(/["']/g, ""));
    return { serif: faces.includes(serif), sans: faces.includes(sans), mono: faces.includes(mono) };
  }, [SERIF, SANS, MONO]);
  expect(loaded).toEqual({ serif: true, sans: true, mono: true });
  expect(external).toEqual([]);
});

test("code and data use JetBrains Mono, falling back to the system monospace", async ({ page }) => {
  await page.goto("/");
  const mono = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-mono-stack"));
  expect(mono).toMatch(new RegExp(`^\\s*["']?${MONO}`));
  expect(mono).toContain("ui-monospace");
});

test("page headlines carry light tracking; sub-heads are serif medium", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const h1 = page.getByRole("heading", { level: 1 }).first();
  const tracking = await h1.evaluate((el) => {
    const s = getComputedStyle(el);
    return parseFloat(s.letterSpacing) / parseFloat(s.fontSize);
  });
  expect(tracking).toBeCloseTo(-0.01, 3);

  // Principles open with a serif lead-in, set heavier than the sentence that follows it.
  const lead = page.locator("#approach .el-steps strong").first();
  expect(await lead.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(SERIF);
  await expect(lead).toHaveCSS("font-weight", "600");
});

test("reading text on editorial pages is set in the serif", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  for (const selector of ["#approach .el-steps p", "#product .el-split-head h2"]) {
    const family = await page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family, selector).toContain(SERIF);
  }
});

test("Agent City titles use the serif like the rest of the product", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/playground/agent-city?demo=library");
  const title = page.getByRole("heading", { level: 1 }).first();
  expect(await title.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(SERIF);
});
