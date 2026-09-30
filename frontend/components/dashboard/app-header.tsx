"use client";

import { SiteHeader } from "@/components/marketing/site-header";

/** Public and workspace routes share the same navigation dimensions and motion. */
export function AppHeader() {
  return <SiteHeader workspace />;
}
