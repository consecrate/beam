import { getFunctionName, type FunctionReference } from "convex/server";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";

const BACKEND = process.env.NEXT_PUBLIC_E2E_BACKEND || "http://localhost:3299";

export async function call(kind: "query" | "mutation", ref: FunctionReference<"query" | "mutation">, args: Record<string, unknown> = {}) {
  const res = await fetch(BACKEND, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, path: getFunctionName(ref), args: convexToJson(args as Value) }),
  });
  const data = (await res.json()) as { value?: JSONValue; error?: string };
  if (!res.ok) throw new Error(data.error ?? `e2e backend error ${res.status}`);
  return jsonToConvex(data.value ?? null);
}
