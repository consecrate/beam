import { z } from "zod";
import { jsonRoute, langSchema } from "@/lib/server/route";
import { cached } from "@/lib/server/cache";
import { lookupWord } from "@/lib/ai/tasks";

export const runtime = "nodejs";

export const POST = jsonRoute(
  z.object({
    lang: langSchema,
    native: langSchema.default("en"),
    term: z.string().min(1).max(200),
    sentence: z.string().min(1).max(2000),
  }),
  async (input) => {
    const { value, cached: hit } = await cached("word", input, () => lookupWord(input));
    return { ...value, cached: hit };
  },
);
