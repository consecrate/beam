import { z } from "zod";
import { jsonRoute, langSchema } from "@/lib/server/route";
import { cacheKey, readCache, writeCache } from "@/lib/server/cache";
import { glossBatch } from "@/lib/ai/tasks";
import type { Gloss } from "@/lib/ai/types";

export const runtime = "nodejs";

const CHUNK = 30;

/**
 * Short in-context glosses for many words at once (the reader prefetches the
 * unknown words of each page). Returns { [term]: Gloss }.
 */
export const POST = jsonRoute(
  z.object({
    lang: langSchema,
    native: langSchema.default("en"),
    items: z.array(z.object({ term: z.string().min(1).max(100), sentence: z.string().min(1).max(2000) })).max(200),
  }),
  async ({ lang, native, items }) => {
    const keyOf = (it: { term: string; sentence: string }) => cacheKey("gloss", { lang, native, term: it.term, sentence: it.sentence });
    const hits = await readCache(items.map(keyOf));
    const out: Record<string, Gloss> = {};
    const missing: typeof items = [];
    for (const it of items) {
      const hit = hits[keyOf(it)] as Gloss | undefined;
      if (hit) out[it.term] = hit;
      else missing.push(it);
    }

    const chunks: (typeof items)[] = [];
    for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));
    const results = await Promise.allSettled(chunks.map((chunk) => glossBatch({ lang, native, items: chunk })));

    const entries: { key: string; kind: string; value: Gloss }[] = [];
    results.forEach((r, ci) => {
      if (r.status !== "fulfilled") {
        console.warn("[beam] gloss chunk failed:", r.reason);
        return;
      }
      const byTerm = new Map(r.value.map((g) => [g.term.toLocaleLowerCase(lang), g]));
      for (const it of chunks[ci]) {
        const g = byTerm.get(it.term.toLocaleLowerCase(lang));
        if (!g) continue;
        const value = { ...g, term: it.term };
        out[it.term] = value;
        entries.push({ key: keyOf(it), kind: "gloss", value });
      }
    });
    await writeCache(entries);
    return out;
  },
);
