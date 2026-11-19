import type { Metadata } from "next";
import "@/components/dashboard/workspace-design.css";
import "./projects-editorial.css";
import { ProjectsEditorialShell } from "./shell";

export const metadata: Metadata = {
  title: "Projects page preview · CodeForge",
  robots: { index: false, follow: false },
};

/** Design study: the projects page, current vs Anthropic-style. */
export default function ProjectsEditorialPreview() {
  return <ProjectsEditorialShell />;
}
