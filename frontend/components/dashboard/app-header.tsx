"use client";

import { SiteHeader } from "@/components/marketing/site-header";

/** Workspace pages use the site's bar, without the marketing dropdowns. */
export function AppHeader() {
  return <SiteHeader workspace />;
}
