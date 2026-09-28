import { z } from "zod";
import { jsonRoute, langSchema } from "@/lib/server/route";
import { cached } from "@/lib/server/cache";
import { explainSentence } from "@/lib/ai/tasks";

export const runtime = "nodejs";

export const POST = jsonRoute(
  z.object({ lang: langSchema, native: langSchema.default("en"), sentence: z.string().min(1).max(3000) }),
  async (input) => (await cached("explain", input, () => explainSentence(input))).value,
);
