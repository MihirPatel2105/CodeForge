import type { Metadata } from "next";
import { AgentCity } from "./agent-city";
import "./city.css";

export const metadata: Metadata = {
  title: "Agent City · CodeForge Playground",
  description: "Take a break in CodeForge’s little developer island. Meet five agents, carry an idea, and hunt a few bugs.",
};

export default function AgentCityPage() {
  return <AgentCity />;
}
