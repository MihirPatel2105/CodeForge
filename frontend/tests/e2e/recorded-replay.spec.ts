import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Recorded replays are the demo fallback for when provider quota or the network gives out:
// a real stored run played from a committed file. They must work with the backend gone.

interface RecordingFixture {
  slug: string;
  title: string;
  source_run_id: string;
  prompt: string;
  events: { event: string; passed?: boolean; total?: number; iterations?: number }[];
  files: Record<string, string>;
}

function recording(slug: string): RecordingFixture {
  const path = join(__dirname, "..", "..", "lib", "recordings", `${slug}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as RecordingFixture;
}

const LOOP = recording("books-review-loop");
const CLEAN = recording("books-clean");
const LOOP_FILES = LOOP.files;

/** Fail every backend call, the way a dead API or a lost network would. */
async function cutTheBackend(page: Page): Promise<string[]> {
  const attempted: string[] = [];
  await page.route("**/api/backend/**", (route) => {
    attempted.push(route.request().url());
    return route.abort("internetdisconnected");
  });
  return attempted;
}

test("the replay index links every committed recording", async ({ page }) => {
  await cutTheBackend(page);
  await page.goto("/replay");

  for (const item of [CLEAN, LOOP]) {
    await expect(page.getByRole("link", { name: new RegExp(item.title) })).toHaveAttribute(
      "href",
      `/replay/${item.slug}`,
    );
  }
});

test("a recorded run plays to its real result with the backend unreachable", async ({ page }) => {
  const attempted = await cutTheBackend(page);
  await page.goto(`/replay/${LOOP.slug}`);

  const provenance = page.getByRole("region", { name: "About this recording" });
  await expect(provenance.getByText("Recorded run", { exact: true })).toBeVisible();
  await expect(provenance).toContainText(LOOP.source_run_id);
  await expect(provenance).toContainText(LOOP.prompt);
  // The overview header must not call a recorded real run a "sample".
  await expect(page.getByText("Sample replay", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Skip" }).click();

  const result = LOOP.events.find((event) => event.event === "tests.result");
  const completed = LOOP.events.find((event) => event.event === "run.completed");
  const summary = page.getByRole("region", { name: "Recorded run result" });
  await expect(summary).toContainText(`${result?.total}/${result?.total}`);
  await expect(summary).toContainText(String(completed?.iterations));
  expect(attempted.filter((url) => url.includes("/runs"))).toEqual([]);
});

test("the code view shows the recorded file contents, not placeholders", async ({ page }) => {
  await cutTheBackend(page);
  await page.goto(`/replay/${LOOP.slug}`);
  await page.getByRole("button", { name: "Skip" }).click();

  await page.getByRole("button", { name: /^main\.py / }).click();
  const firstLine = LOOP_FILES["main.py"].split("\n")[0];
  await expect(page.locator("#generated-code-canvas")).toContainText(firstLine);
});

test("an unknown recording is a real 404", async ({ page }) => {
  const response = await page.goto("/replay/not-a-recording");
  expect(response?.status()).toBe(404);
});

test("a recorded run fits a phone screen without sideways scrolling", async ({ page }) => {
  await cutTheBackend(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/replay/${CLEAN.slug}`);
  await page.getByRole("button", { name: "Skip" }).click();

  await expect(page.getByRole("region", { name: "Recorded run result" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
