import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Claude Haiku 4.5: fast and cheap enough to call on every click.
export const MODEL = process.env.BEAM_MODEL || "claude-haiku-4-5";

export type ProviderName = "subscription" | "api" | "mock";

export interface JsonRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * Picks how to reach Claude:
 * - "api": ANTHROPIC_API_KEY is set (fastest; pay-as-you-go API billing).
 * - "subscription": your Claude Pro/Max plan, through the Claude Agent SDK,
 *   which runs Claude Code with the login from `claude login` (or
 *   CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`).
 * - "mock": canned answers for offline development and tests.
 * Override with BEAM_AI_PROVIDER.
 */
export function providerName(): ProviderName {
  const forced = process.env.BEAM_AI_PROVIDER as ProviderName | undefined;
  if (forced === "subscription" || forced === "api" || forced === "mock") return forced;
  return process.env.ANTHROPIC_API_KEY ? "api" : "subscription";
}

export async function generateJson<T>(req: JsonRequest): Promise<T> {
  const name = providerName();
  if (name === "mock") {
    const { mockJson } = await import("./mock");
    return mockJson(req) as T;
  }
  return limit(() => (name === "api" ? viaApi<T>(req) : viaSubscription<T>(req)));
}

// ---------- concurrency limit (each subscription call is a subprocess) ----------

const MAX_CONCURRENT = Number(process.env.BEAM_AI_CONCURRENCY || 4);
let running = 0;
const waiting: (() => void)[] = [];

async function limit<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

// ---------- Anthropic API ----------

let client: Anthropic | null = null;

async function viaApi<T>({ system, prompt, schema, maxTokens }: JsonRequest): Promise<T> {
  client ??= new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens ?? 1024,
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema } },
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request.");
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseJson<T>(text);
}

// ---------- Claude subscription via the Claude Agent SDK ----------

async function viaSubscription<T>({ system, prompt, schema }: JsonRequest): Promise<T> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  // Drop any API key so Claude Code authenticates with the subscription login.
  const env: Record<string, string | undefined> = { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "beam/0.1" };
  delete env.ANTHROPIC_API_KEY;

  const run = query({
    prompt,
    options: {
      model: MODEL,
      systemPrompt: system,
      tools: [],
      settingSources: [],
      persistSession: false,
      maxTurns: 3,
      outputFormat: { type: "json_schema", schema },
      env,
    },
  });

  for await (const msg of run) {
    if (msg.type !== "result") continue;
    if (msg.subtype === "success") {
      if (msg.structured_output !== undefined && msg.structured_output !== null) return msg.structured_output as T;
      return parseJson<T>(msg.result);
    }
    throw new Error(`Claude Code request failed (${msg.subtype}). Is \`claude\` logged in? Run \`npx claude login\`.`);
  }
  throw new Error("Claude Code returned no result.");
}

export function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("Claude returned malformed JSON.");
  }
}
