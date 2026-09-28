import { NextResponse } from "next/server";
import { MODEL, providerName } from "@/lib/ai/provider";
import { translateSentence } from "@/lib/ai/tasks";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ provider: providerName(), model: MODEL });
}

/** Makes a real (uncached) call so the settings page can confirm Claude is reachable. */
export async function POST() {
  const started = Date.now();
  try {
    const res = await translateSentence({ lang: "de", native: "en", sentence: "Guten Morgen! Wie geht es dir?" });
    return NextResponse.json({ ok: true, provider: providerName(), model: MODEL, ms: Date.now() - started, sample: res.translation });
  } catch (err) {
    return NextResponse.json({ ok: false, provider: providerName(), model: MODEL, error: (err as Error).message }, { status: 502 });
  }
}
