// Stand-in Convex backend for end-to-end tests: runs the real Convex functions
// in memory with convex-test and serves them over HTTP to the shims in ./shims.
// Usage: npx tsx e2e/backend.ts   (listens on E2E_BACKEND_PORT, default 3299)
import http from "node:http";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import schema from "../convex/schema";

const modules: Record<string, () => Promise<unknown>> = {
  "../convex/_generated/api.js": () => import("../convex/_generated/api.js"),
  "../convex/_generated/server.js": () => import("../convex/_generated/server.js"),
  "../convex/aiCache.ts": () => import("../convex/aiCache"),
  "../convex/lessons.ts": () => import("../convex/lessons"),
  "../convex/model.ts": () => import("../convex/model"),
  "../convex/review.ts": () => import("../convex/review"),
  "../convex/seed.ts": () => import("../convex/seed"),
  "../convex/settings.ts": () => import("../convex/settings"),
  "../convex/stats.ts": () => import("../convex/stats"),
  "../convex/words.ts": () => import("../convex/words"),
};

const t = convexTest(schema, modules);
const port = Number(process.env.E2E_BACKEND_PORT || 3299);

http
  .createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") return res.end();
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      const { kind, path, args } = JSON.parse(raw) as { kind: "query" | "mutation"; path: string; args: JSONValue };
      const decoded = jsonToConvex(args) as Record<string, Value>;
      const result =
        kind === "query"
          ? await t.query(makeFunctionReference<"query">(path), decoded)
          : await t.mutation(makeFunctionReference<"mutation">(path), decoded);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ value: convexToJson((result ?? null) as Value) }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  })
  .listen(port, () => console.log(`e2e Convex stand-in on http://localhost:${port}`));
