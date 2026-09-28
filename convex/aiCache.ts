import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Cache of Claude responses, written by the Next.js AI routes so repeated
// lookups (same word in the same sentence) are instant and free.

export const getMany = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const out: Record<string, unknown> = {};
    for (const key of keys.slice(0, 500)) {
      const row = await ctx.db.query("aiCache").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (row) out[key] = row.value;
    }
    return out;
  },
});

export const putMany = mutation({
  args: { entries: v.array(v.object({ key: v.string(), kind: v.string(), value: v.any() })) },
  handler: async (ctx, { entries }) => {
    const now = Date.now();
    for (const { key, kind, value } of entries.slice(0, 500)) {
      const row = await ctx.db.query("aiCache").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (row) await ctx.db.patch(row._id, { value, createdAt: now });
      else await ctx.db.insert("aiCache", { key, kind, value, createdAt: now });
    }
  },
});
