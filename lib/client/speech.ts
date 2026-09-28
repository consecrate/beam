import { LANGUAGES } from "../langs";

// Text-to-speech through the browser's built-in voices (free, offline-capable).

export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const tag = LANGUAGES[lang]?.speech ?? lang;
  const base = tag.split("-")[0];
  const all = window.speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(base));
  // Prefer the exact regional voice and the higher quality "natural"/"premium"/Google ones.
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.replace("_", "-") === tag ? 4 : 0) + (/natural|premium|enhanced|neural/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return all.sort((a, b) => score(b) - score(a));
}

export function speechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(
  text: string,
  opts: { lang: string; rate?: number; voice?: string; onEnd?: () => void; onBoundary?: (charIndex: number) => void },
) {
  if (!speechAvailable()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGUAGES[opts.lang]?.speech ?? opts.lang;
  u.rate = opts.rate ?? 0.9;
  const voices = voicesFor(opts.lang);
  const v = voices.find((x) => x.name === opts.voice) ?? voices[0];
  if (v) u.voice = v;
  if (opts.onEnd) {
    u.onend = opts.onEnd;
    u.onerror = opts.onEnd;
  }
  if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary!(e.charIndex);
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
