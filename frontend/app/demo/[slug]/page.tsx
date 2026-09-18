"use client";

import { useParams } from "next/navigation";
import { DemoRunPage } from "@/components/demo/demo-run-page";
import { getDemoRun } from "@/lib/demo-runs";

export default function DemoRoute() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  return <DemoRunPage demo={getDemoRun(slug)} />;
}
