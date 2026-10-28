import type { Metadata } from "next";
import { AgentCity } from "./agent-city";
import { LiveAgentCity } from "./live-agent-city";
import "./city.css";
import "./live-city.css";

export const metadata: Metadata = {
  title: "Agent City · CodeForge",
  description: "Watch CodeForge’s agents turn an idea into a working API in a live miniature city.",
};

export default async function AgentCityPage({ searchParams }: { searchParams: Promise<{ run?: string; demo?: string }> }) {
  const query = await searchParams;
  if (typeof query.run === "string") {
    const valid = /^[a-zA-Z0-9_-]{1,128}$/.test(query.run);
    return <LiveAgentCity key={query.run} runId={valid ? query.run : null} invalidRun={!valid} />;
  }
  if (typeof query.demo === "string") return <LiveAgentCity runId={null} demoSlug={query.demo} />;
  return <AgentCity />;
}
