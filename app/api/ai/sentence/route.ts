import { z } from "zod";
import { jsonRoute, langSchema } from "@/lib/server/route";
import { cached } from "@/lib/server/cache";
import { translateSentence } from "@/lib/ai/tasks";

export const runtime = "nodejs";

export const POST = jsonRoute(
  z.object({
    lang: langSchema,
    native: langSchema.default("en"),
    sentence: z.string().min(1).max(3000),
    context: z.string().max(3000).optional(),
  }),
  async (input) => (await cached("sentence", { ...input, context: undefined }, () => translateSentence(input))).value,
);
