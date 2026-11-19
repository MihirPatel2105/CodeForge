import { expect, test } from "@playwright/test";

// One page edge (app/premium-system.css): every page's content starts under the header's logo
// and ends under its account button, at every width. So does the site footer.

const ROUTES = [
  "/", "/how-it-works", "/about", "/faq", "/contact", "/privacy", "/demo/library",
  "/projects", "/projects/p1", "/runs/r1", "/runs/r1/use", "/runs/r1/try", "/runs/r1/publish",
  "/profile", "/profile/settings", "/profile/settings/password",
];

for (const width of [1440, 1920, 390]) {
  test(`page content shares the header's edges at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
    await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
      id: "edge-user", email: "user@example.com", first_name: "Edge", is_admin: false, email_verified: true, created_at: "2026-10-01T00:00:00Z",
    } }));
    // A real project, so /projects/p1 shows the workspace rather than its narrow not-found message.
    await page.route("**/api/backend/projects/p1", route => route.fulfill({ json: { id: "p1", name: "Edges", description: "", created_at: "2026-10-01T00:00:00Z" } }));
    await page.route("**/api/backend/projects/p1/runs/page*", route => route.fulfill({ json: { items: [], next_cursor: null, stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: null, last: null } } }));
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.locator(".cf-page, .el-body").first(), route).toBeAttached();
      const edges = await page.evaluate(() => {
        const box = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return { left: rect.left + parseFloat(style.paddingLeft), right: rect.right - parseFloat(style.paddingRight) };
        };
        const footer = document.querySelector("footer .cf-page");
        return { bar: box(document.querySelector(".lh-bar")!), content: box(document.querySelector(".cf-page, .el-body")!), footer: footer ? box(footer) : null };
      });
      expect(Math.abs(edges.content.left - edges.bar.left), `${route} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(edges.content.right - edges.bar.right), `${route} right`).toBeLessThanOrEqual(1);
      // The site footer, where a page has one, shares the same edges.
      if (edges.footer) {
        expect(Math.abs(edges.footer.left - edges.bar.left), `${route} footer left`).toBeLessThanOrEqual(1);
        expect(Math.abs(edges.footer.right - edges.bar.right), `${route} footer right`).toBeLessThanOrEqual(1);
      }
    }
  });
}
