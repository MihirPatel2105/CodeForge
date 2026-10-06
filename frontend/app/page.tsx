import type { Metadata } from "next";
import { LandingAtmosphere } from "@/components/marketing/landing-atmosphere";
import { PremiumLanding } from "@/components/marketing/premium-landing";

export const metadata: Metadata = {
  title: "CodeForge — From an idea to an API",
  description:
    "Meet the five AI agents that plan, build, review and test your API. Follow every decision, approve the plan, and inspect the result.",
};

export default function LandingPage() {
  return <LandingAtmosphere><PremiumLanding /></LandingAtmosphere>;
}
