import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Wraps a JSON route: validates the body with `schema` and turns errors into JSON responses. */
export function jsonRoute<S extends z.ZodType, R>(schema: S, fn: (input: z.infer<S>) => Promise<R>) {
  return async (req: Request) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
    }
    try {
      return NextResponse.json(await fn(parsed.data));
    } catch (err) {
      console.error("[beam]", err);
      return NextResponse.json({ error: (err as Error).message || "Request failed" }, { status: 502 });
    }
  };
}

export const langSchema = z.string().min(2).max(8);
