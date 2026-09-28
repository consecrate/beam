import { describe, expect, it } from "vitest";
import { normalizeTerm, parseText, splitIntoParts, splitSentences, subtitlesToText, tokenize, uniqueTerms } from "../lib/text";

describe("tokenize", () => {
  it("keeps umlauts, ß, hyphenated compounds and contractions together", () => {
    const words = tokenize("Die E-Mail geht's nicht? Straße, Übung!").filter((t) => t.kind === "word");
    expect(words.map((w) => w.text)).toEqual(["Die", "E-Mail", "geht's", "nicht", "Straße", "Übung"]);
    expect(words.map((w) => w.term)).toEqual(["die", "e-mail", "geht's", "nicht", "straße", "übung"]);
  });

  it("round-trips the original text", () => {
    const text = "„Hallo!“, sagte sie – und ging. 3 Äpfel…";
    expect(tokenize(text).map((t) => t.text).join("")).toBe(text);
  });

  it("normalizes curly apostrophes", () => {
    expect(normalizeTerm("Geht’s")).toBe("geht's");
  });
});

describe("splitSentences", () => {
  it("splits on sentence punctuation", () => {
    expect(splitSentences("Ich bin müde. Du bist wach! Wer kommt? Niemand.")).toEqual([
      "Ich bin müde.",
      "Du bist wach!",
      "Wer kommt?",
      "Niemand.",
    ]);
  });

  it("does not split after abbreviations, ordinals or before lowercase", () => {
    expect(splitSentences("Wir kaufen z.B. Brot. Am 3. Mai kommt Dr. Weber. Er sagt... na ja.")).toEqual([
      "Wir kaufen z.B. Brot.",
      "Am 3. Mai kommt Dr. Weber.",
      "Er sagt... na ja.",
    ]);
  });

  it("keeps closing quotes with their sentence", () => {
    expect(splitSentences('„So ein Mist!", sagt er. „Ja!" Max lacht.')).toEqual(['„So ein Mist!", sagt er.', '„Ja!"', "Max lacht."]);
  });
});

describe("parseText", () => {
  it("paginates on paragraph boundaries near the target size", () => {
    const para = "Das ist ein kurzer Satz mit acht Wörtern hier. ".repeat(5).trim(); // 45 words
    const text = Array.from({ length: 10 }, () => para).join("\n\n");
    const parsed = parseText(text, "de", 100);
    expect(parsed.wordCount).toBe(450);
    expect(parsed.pages.length).toBeGreaterThanOrEqual(4);
    for (const p of parsed.pages) expect(p.wordCount).toBeLessThanOrEqual(135);
    // Every sentence appears exactly once, in order.
    expect(parsed.pages.flatMap((p) => p.blocks.flat())).toEqual(parsed.sentences.map((s) => s.id));
  });

  it("handles empty text", () => {
    expect(parseText("   ").pages).toEqual([]);
  });
});

describe("uniqueTerms / splitIntoParts / subtitles", () => {
  it("dedupes case-insensitively in first-seen order", () => {
    expect(uniqueTerms("Der Hund und der Hund. Die Katze.")).toEqual(["der", "hund", "und", "die", "katze"]);
  });

  it("splits long texts into parts by paragraph", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Absatz ${i} ` + "wort ".repeat(98)).join("\n\n");
    const parts = splitIntoParts(text, 1000);
    expect(parts.length).toBe(3);
    expect(parts.join("\n\n")).toBe(text.split("\n\n").map((p) => p.trim()).join("\n\n"));
  });

  it("strips SRT timing lines", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nHallo, wie\n\n2\n00:00:02,500 --> 00:00:04,000\ngeht es dir?\n\n3\n00:00:05,000 --> 00:00:06,000\n<i>Gut.</i>";
    expect(subtitlesToText(srt)).toBe("Hallo, wie geht es dir? Gut.");
  });
});
