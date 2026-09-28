import { z } from "zod";
import { jsonRoute, langSchema } from "@/lib/server/route";
import { convexClient } from "@/lib/server/cache";
import { simplifyText } from "@/lib/ai/tasks";
import { LEVELS } from "@/lib/langs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const maxDuration = 180;

/** Rewrites a lesson at an easier CEFR level and saves it as a new lesson. */
export const POST = jsonRoute(
  z.object({ lessonId: z.string().min(1), native: langSchema.default("en"), level: z.enum(LEVELS) }),
  async ({ lessonId, native, level }) => {
    const convex = convexClient();
    const lesson = await convex.query(api.lessons.get, { id: lessonId as Id<"lessons"> });
    if (!lesson) throw new Error("Lesson not found");
    const out = await simplifyText({ lang: lesson.lang, native, level, title: lesson.title, text: lesson.text });
    const id = await convex.mutation(api.lessons.create, {
      lang: lesson.lang,
      title: out.title,
      text: out.text,
      level,
      source: "simplified",
      description: `Simplified (${level}) from “${lesson.title}”`,
      sourceUrl: lesson.sourceUrl,
    });
    return { id };
  },
);
