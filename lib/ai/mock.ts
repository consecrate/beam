import type { JsonRequest } from "./provider";

// Deterministic stand-in for Claude, used when BEAM_AI_PROVIDER=mock
// (offline development and automated tests).

function quoted(prompt: string, label: string): string {
  const m = prompt.match(new RegExp(`${label}: «([^»]*)»`));
  return m?.[1] ?? "";
}

export function mockJson(req: JsonRequest): unknown {
  const props = Object.keys((req.schema as { properties?: Record<string, unknown> }).properties ?? {});
  if (props.includes("items")) {
    const items = [...req.prompt.matchAll(/^\d+\. «([^»]*)»/gm)].map((m) => ({
      term: m[1],
      translation: `~${m[1]}`,
      lemma: m[1],
      gender: /^[A-ZÄÖÜ]/.test(m[1]) ? "m" : "",
    }));
    return { items };
  }
  if (props.includes("expression")) {
    const term = quoted(req.prompt, "Word to explain") || quoted(req.prompt, "Phrase to explain");
    return {
      translation: `[${term}]`,
      alternatives: ["alt one", "alt two"],
      lemma: term.toLowerCase(),
      pos: "noun",
      gender: "m",
      article: "der",
      plural: `${term}e`,
      form: "nominative singular",
      note: "Mock note: this is where a grammar tip appears.",
      expression: "",
      expressionTranslation: "",
    };
  }
  if (props.includes("chunks")) {
    return {
      translation: "Mock translation of the sentence.",
      literal: "Mock literal translation.",
      chunks: [{ text: "Mock", meaning: "mock", note: "" }],
      grammar: ["Mock grammar point."],
    };
  }
  if (props.includes("title") && props.includes("text")) {
    return {
      title: "Eine kleine Geschichte",
      text: "Anna geht in den Park. Sie sieht einen Hund.\n\nDer Hund ist sehr groß. Anna lacht.",
    };
  }
  if (props.includes("translation")) return { translation: "Mock translation of the sentence." };
  return {};
}
