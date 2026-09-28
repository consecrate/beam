"use client";
// Test-only replacement for `convex/react` (aliased in next.config.ts when BEAM_E2E=1).
import { getFunctionName, type FunctionReference } from "convex/server";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { call } from "./call";

const listeners = new Set<() => void>();
const invalidate = () => listeners.forEach((l) => l());

export class ConvexReactClient {
  constructor(_url: string) {}
}

export function ConvexProvider({ children }: { client: unknown; children: ReactNode }) {
  return <>{children}</>;
}

export function useQuery(ref: FunctionReference<"query">, args?: Record<string, unknown> | "skip") {
  const key = args === "skip" ? null : JSON.stringify([getFunctionName(ref), args ?? {}]);
  const [state, setState] = useState<{ key: string | null; value: unknown; error?: Error }>({ key: null, value: undefined });
  const load = useCallback(() => {
    if (key === null) return;
    call("query", ref, (args as Record<string, unknown>) ?? {}).then(
      (value) => setState({ key, value }),
      (error: Error) => setState({ key, value: undefined, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    load();
    listeners.add(load);
    return () => void listeners.delete(load);
  }, [load]);
  if (state.key === key && state.error) throw state.error;
  return state.key === key ? state.value : undefined;
}

export function useMutation(ref: FunctionReference<"mutation">) {
  const fn = (args: Record<string, unknown>) =>
    call("mutation", ref, args).then((r) => {
      invalidate();
      return r;
    });
  (fn as unknown as { withOptimisticUpdate: () => typeof fn }).withOptimisticUpdate = () => fn;
  return fn as typeof fn & { withOptimisticUpdate: (u: unknown) => typeof fn };
}

export function useConvex() {
  return { query: (ref: FunctionReference<"query">, args: Record<string, unknown>) => call("query", ref, args) };
}
