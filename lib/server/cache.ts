import "server-only";
import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { MODEL } from "../ai/provider";

let convex: ConvexHttpClient | null = null;

export function convexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` first.");
  convex ??= new ConvexHttpClient(url);
  return convex;
}

// Bump to invalidate cached answers after prompt changes.
const PROMPT_VERSION = 1;

export function cacheKey(kind: string, input: unknown): string {
  const hash = createHash("sha256").update(JSON.stringify([PROMPT_VERSION, MODEL, input])).digest("hex").slice(0, 32);
  return `${kind}:${hash}`;
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Returns the cached answer for `input`, or computes it with `fn`, stores it
 * in Convex, and returns it. Concurrent identical requests share one call.
 */
export async function cached<T>(kind: string, input: unknown, fn: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
  const key = cacheKey(kind, input);
  const hit = await readCache([key]);
  if (key in hit) return { value: hit[key] as T, cached: true };

  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn().then(async (value) => {
      await writeCache([{ key, kind, value }]);
      return value;
    });
    inflight.set(key, p);
    p.finally(() => inflight.delete(key)).catch(() => {});
  }
  return { value: await p, cached: false };
}

export async function readCache(keys: string[]): Promise<Record<string, unknown>> {
  try {
    return (await convexClient().query(api.aiCache.getMany, { keys })) as Record<string, unknown>;
  } catch (err) {
    console.warn("[beam] AI cache read failed:", (err as Error).message);
    return {};
  }
}

export async function writeCache(entries: { key: string; kind: string; value: unknown }[]) {
  if (!entries.length) return;
  try {
    await convexClient().mutation(api.aiCache.putMany, { entries });
  } catch (err) {
    console.warn("[beam] AI cache write failed:", (err as Error).message);
  }
}
