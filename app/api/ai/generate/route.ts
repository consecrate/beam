import { z } from "zod";
import { jsonRoute, langSchema } from "@/lib/server/route";
import { convexClient } from "@/lib/server/cache";
import { generateLesson } from "@/lib/ai/tasks";
import { LEVELS } from "@/lib/langs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Writes a new graded story with Claude and adds it to the library. */
export const POST = jsonRoute(
  z.object({
    lang: langSchema,
    native: langSchema.default("en"),
    level: z.enum(LEVELS),
    topic: z.string().max(500).default(""),
    style: z.string().max(100).default("short story"),
    words: z.number().int().min(80).max(1500).default(300),
    targetWords: z.array(z.string().max(80)).max(40).default([]),
  }),
  async (input) => {
    const lesson = await generateLesson(input);
    const id = await convexClient().mutation(api.lessons.create, {
      lang: input.lang,
      title: lesson.title,
      text: lesson.text,
      level: input.level,
      source: "ai",
      description: input.topic ? `AI story: ${input.topic}` : "AI-generated story",
    });
    return { id };
  },
);
