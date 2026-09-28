// Test-only replacement for `convex/browser` used by the Next.js API routes.
import type { FunctionReference } from "convex/server";
import { call } from "./call";

export class ConvexHttpClient {
  constructor(_url: string) {}
  query(ref: FunctionReference<"query">, args: Record<string, unknown>) {
    return call("query", ref, args) as Promise<never>;
  }
  mutation(ref: FunctionReference<"mutation">, args: Record<string, unknown>) {
    return call("mutation", ref, args) as Promise<never>;
  }
}
