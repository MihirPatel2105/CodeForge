import type { Metadata } from "next";
import { EditorialLanding } from "@/components/marketing/editorial-landing";

export const metadata: Metadata = {
  title: "CodeForge — From an idea to an API",
  description:
    "Meet the five AI agents that plan, build, review and test your API. Follow every decision, approve the plan, and inspect the result.",
};

export default function LandingPage() {
  return <EditorialLanding />;
}
