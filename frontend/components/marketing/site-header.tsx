"use client";

import { LaunchHeader } from "./launch-hero/launch-header";

/**
 * Site header: one bar for the whole product. Public pages and the signed-in workspace
 * (projects, runs, profile, settings, admin) share it, so moving between them keeps the
 * same logo, account group and behaviour. The workspace leaves out the marketing dropdowns.
 * Over a dark hero the bar starts transparent; everywhere else it is solid.
 */
export function SiteHeader({ heroOverlay = false, workspace = false }: { heroOverlay?: boolean; workspace?: boolean }) {
  return <LaunchHeader heroId={heroOverlay ? "overview" : undefined} siteNav={!workspace} />;
}
