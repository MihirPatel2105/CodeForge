import type { Metadata } from "next";
import "@/components/dashboard/workspace-design.css";
import "./premium.css";
import "./editorial.css";
import { ProjectPremiumShell } from "./shell";

export const metadata: Metadata = {
  title: "Project workspace preview · CodeForge",
  robots: { index: false, follow: false },
};

/** Design study: the project page's stats, prompt card and run history, current vs proposed. */
export default function ProjectPremiumPreview() {
  return <ProjectPremiumShell />;
}
