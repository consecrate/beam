import { Reader } from "@/components/reader/Reader";
import type { Id } from "@/convex/_generated/dataModel";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Reader lessonId={id as Id<"lessons">} />;
}
