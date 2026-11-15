import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecordedRunPage } from "@/components/demo/recorded-run-page";
import { getRecording, listRecordings } from "@/lib/recordings";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams(): { slug: string }[] {
  return listRecordings().map((recording) => ({ slug: recording.slug }));
}

// Only committed recordings exist; anything else is a real 404, not a fallback page.
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recording = getRecording((await params).slug);
  return { title: recording ? `${recording.title} · Recorded run` : "Recorded run" };
}

export default async function RecordedReplayRoute({ params }: Props) {
  const recording = getRecording((await params).slug);
  if (!recording) notFound();
  return <RecordedRunPage recording={recording} />;
}
