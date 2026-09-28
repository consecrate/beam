import { z } from "zod";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { jsonRoute } from "@/lib/server/route";

export const runtime = "nodejs";

const BLOCKS = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,dt,dd";

/** Fetches an article and extracts its readable text, one paragraph per block. */
export const POST = jsonRoute(z.object({ url: z.string().url() }), async ({ url }) => {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) URLs are supported.");
  const res = await fetch(u, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; BeamReader/0.1; +https://github.com/consecrate/beam)",
      "accept-language": "de,en;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`The site answered ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (type.includes("text/plain")) return { title: u.hostname, text: raw.slice(0, 300_000) };

  const { document } = parseHTML(raw);
  const article = new Readability(document as unknown as Document).parse();
  if (!article?.content) throw new Error("Couldn't find the article text on that page.");

  const { document: content } = parseHTML(`<!doctype html><html><body>${article.content}</body></html>`);
  const paragraphs: string[] = [];
  for (const el of content.querySelectorAll(BLOCKS)) {
    // Skip containers whose text is already captured by a nested block.
    if (el.querySelector(BLOCKS)) continue;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  }
  const text = paragraphs.length ? paragraphs.join("\n\n") : (article.textContent ?? "").trim();
  return { title: article.title || u.hostname, text: text.slice(0, 300_000), siteName: article.siteName ?? undefined };
});
